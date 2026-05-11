"""
用户认证测试套件
- 登录/注册/权限验证
- Token 验证/过期/刷新
- 越权访问测试
"""
import pytest
import asyncio
from datetime import datetime, timedelta
import jwt


class TestAuthLogin:
    """登录功能测试"""

    async def test_admin_login_success(self, client):
        """测试管理员正常登录"""
        response = await client.post("/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert data["message"] == "登录成功"
        assert "token" in data["data"]
        assert data["data"]["user"]["role"] == "admin"

    async def test_supplier_login_success(self, client, supplier_user):
        """测试供应商正常登录"""
        response = await client.post("/auth/login", json={
            "username": "test_supplier",
            "password": "supplier123"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert data["data"]["user"]["role"] == "supplier"

    async def test_login_wrong_password(self, client):
        """测试错误密码"""
        response = await client.post("/auth/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })

        assert response.status_code == 401
        data = response.json()
        assert data["code"] == 401
        assert "用户名或密码错误" in data["message"]

    async def test_login_nonexistent_user(self, client):
        """测试不存在的用户"""
        response = await client.post("/auth/login", json={
            "username": "nonexistent_user_12345",
            "password": "password123"
        })

        assert response.status_code == 401
        data = response.json()
        assert data["code"] == 401

    async def test_login_empty_username(self, client):
        """测试空用户名"""
        response = await client.post("/auth/login", json={
            "username": "",
            "password": "admin123"
        })

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == 400

    async def test_login_empty_password(self, client):
        """测试空密码"""
        response = await client.post("/auth/login", json={
            "username": "admin",
            "password": ""
        })

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == 400

    async def test_login_missing_fields(self, client):
        """测试缺少字段"""
        # 缺少 username
        response = await client.post("/auth/login", json={
            "password": "admin123"
        })
        assert response.status_code == 400

        # 缺少 password
        response = await client.post("/auth/login", json={
            "username": "admin"
        })
        assert response.status_code == 400

    async def test_login_sql_injection_attempt(self, client):
        """测试 SQL 注入攻击防护"""
        response = await client.post("/auth/login", json={
            "username": "admin' OR '1'='1",
            "password": "admin123"
        })

        assert response.status_code == 401

    async def test_login_disabled_user(self, client, admin_headers):
        """测试禁用用户登录"""
        # 创建并禁用用户
        response = await client.post("/suppliers", json={
            "username": "disabled_user",
            "password": "password123",
            "real_name": "待禁用用户",
            "company_name": "测试公司"
        }, headers=admin_headers)

        # 获取刚创建的用户ID
        if response.status_code == 200:
            user_id = response.json()["data"]["id"]
            # 禁用用户
            await client.put(f"/suppliers/{user_id}/toggle-status", headers=admin_headers)

        # 尝试登录
        response = await client.post("/auth/login", json={
            "username": "disabled_user",
            "password": "password123"
        })
        assert response.status_code == 403
        data = response.json()
        assert "禁用" in data["message"]


class TestAuthToken:
    """Token 验证测试"""

    async def test_access_without_token(self, client):
        """测试无 token 访问"""
        response = await client.get("/tenders")
        assert response.status_code == 401
        data = response.json()
        assert "令牌" in data["message"] or "认证" in data["message"]

    async def test_access_with_invalid_token(self, client):
        """测试无效 token"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = await client.get("/tenders", headers=headers)
        assert response.status_code == 401

    async def test_access_with_expired_token(self, client):
        """测试过期 token"""
        # 生成一个过期的 token
        expired_payload = {
            "id": "00000000-0000-0000-0000-000000000000",
            "username": "admin",
            "role": "admin",
            "exp": datetime.utcnow() - timedelta(hours=1)
        }
        secret = "bidding_system_secret_key_2024"
        expired_token = jwt.encode(expired_payload, secret, algorithm="HS256")

        headers = {"Authorization": f"Bearer {expired_token}"}
        response = await client.get("/tenders", headers=headers)
        assert response.status_code == 401


class TestAuthorization:
    """权限测试"""

    async def test_supplier_access_admin_api(self, client, supplier_token):
        """测试供应商访问管理员接口"""
        headers = {"Authorization": f"Bearer {supplier_token}"}
        response = await client.get("/suppliers", headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert "权限不足" in data["message"]

    async def test_judge_access_admin_api(self, client, judge_token):
        """测试评委访问管理员接口"""
        headers = {"Authorization": f"Bearer {judge_token}"}
        response = await client.get("/suppliers", headers=headers)
        assert response.status_code == 403

    async def test_supplier_can_view_tenders(self, client, supplier_token):
        """测试供应商可以查看招标列表"""
        headers = {"Authorization": f"Bearer {supplier_token}"}
        response = await client.get("/tenders/my-tenders", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200

    async def test_judge_can_view_bids(self, client, judge_token):
        """测试评委可以查看投标"""
        headers = {"Authorization": f"Bearer {judge_token}"}
        response = await client.get("/bids/tender/some-id", headers=headers)
        # 404 是合理的（ID 不存在），关键是不应返回 403
        assert response.status_code != 403


class TestSupplierAPI:
    """供应商管理 API 测试"""

    async def test_create_supplier(self, client, admin_headers):
        """测试创建供应商"""
        response = await client.post("/suppliers", json={
            "username": f"new_supplier_{datetime.now().timestamp()}",
            "password": "supplier123",
            "real_name": "新供应商",
            "company_name": "新科技公司",
            "phone": "13900139000"
        }, headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200

    async def test_create_duplicate_supplier(self, client, admin_headers):
        """测试创建重复供应商"""
        response = await client.post("/suppliers", json={
            "username": "test_supplier",
            "password": "supplier123"
        }, headers=admin_headers)

        assert response.status_code == 400
        data = response.json()
        assert "已存在" in data["message"]

    async def test_list_suppliers(self, client, admin_headers):
        """测试供应商列表"""
        response = await client.get("/suppliers", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "list" in data["data"]

    async def test_toggle_supplier_status(self, client, admin_headers, supplier_user):
        """测试启用/禁用供应商"""
        user_id = supplier_user.get("id")
        if not user_id:
            pytest.skip("没有供应商用户 ID")

        response = await client.put(f"/suppliers/{user_id}/toggle-status", headers=admin_headers)
        assert response.status_code == 200


class TestBidAPI:
    """投标 API 测试"""

    async def test_submit_bid(self, client, supplier_headers, published_tender):
        """测试提交投标"""
        bid_data = {
            "tender_id": published_tender["id"],
            "bid_price": 950000,
            "technical_proposal": "技术方案详情...",
            "business_proposal": "商务方案详情..."
        }
        response = await client.post("/bids", json=bid_data, headers=supplier_headers)
        # 可能返回 200 或 400（已投标）
        assert response.status_code in [200, 400]

    async def test_bid_without_auth(self, client, published_tender):
        """测试未认证提交投标"""
        bid_data = {
            "tender_id": published_tender["id"],
            "bid_price": 950000
        }
        response = await client.post("/bids", json=bid_data)
        assert response.status_code == 401

    async def test_bid_zero_price(self, client, supplier_headers, published_tender):
        """测试零报价投标"""
        bid_data = {
            "tender_id": published_tender["id"],
            "bid_price": 0
        }
        response = await client.post("/bids", json=bid_data, headers=supplier_headers)
        assert response.status_code == 400


class TestTenderAPI:
    """招标 API 测试"""

    async def test_create_tender(self, client, admin_headers):
        """测试创建招标"""
        response = await client.post("/tenders", json={
            "title": "API测试招标项目",
            "project_number": f"API-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "category": "IT服务",
            "budget": 500000,
            "description": "通过API测试创建的招标项目",
            "bid_deadline": (datetime.now() + timedelta(days=14)).isoformat(),
            "open_bid_date": (datetime.now() + timedelta(days=15)).isoformat()
        }, headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200

    async def test_publish_tender(self, client, admin_headers, sample_tender):
        """测试发布招标"""
        response = await client.put(
            f"/tenders/{sample_tender['id']}/publish",
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_delete_draft_tender(self, client, admin_headers, sample_tender):
        """测试删除草稿招标"""
        response = await client.delete(
            f"/tenders/{sample_tender['id']}",
            headers=admin_headers
        )
        assert response.status_code == 200


class TestJudgeAPI:
    """评委 API 测试"""

    async def test_create_judge(self, client, admin_headers):
        """测试创建评委"""
        response = await client.post("/judges", json={
            "username": f"test_judge_{datetime.now().timestamp()}",
            "password": "judge123",
            "real_name": "自动化测试评委",
            "specialty": "建筑工程",
            "title": "高级工程师"
        }, headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200

    async def test_list_judges(self, client, admin_headers):
        """测试评委列表"""
        response = await client.get("/judges", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200


class TestValidation:
    """参数校验测试"""

    async def test_create_tender_missing_title(self, client, admin_headers):
        """测试创建招标缺少标题"""
        response = await client.post("/tenders", json={
            "project_number": "TEST-NO-TITLE"
        }, headers=admin_headers)
        assert response.status_code == 400
        data = response.json()
        assert data["code"] == 400

    async def test_create_supplier_short_password(self, client, admin_headers):
        """测试供应商密码过短"""
        response = await client.post("/suppliers", json={
            "username": "short_pwd_user",
            "password": "12345"
        }, headers=admin_headers)
        assert response.status_code == 400
        data = response.json()
        assert data["code"] == 400

    async def test_create_judge_missing_name(self, client, admin_headers):
        """测试创建评委缺少姓名"""
        response = await client.post("/judges", json={
            "username": "noname_judge",
            "password": "judge123"
        }, headers=admin_headers)
        assert response.status_code == 400
        data = response.json()
        assert data["code"] == 400


class TestHealthCheck:
    """健康检查测试"""

    async def test_health_endpoint(self, client):
        """测试健康检查接口"""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "服务运行中" in data["message"]

    async def test_nonexistent_endpoint(self, client):
        """测试不存在的接口"""
        response = await client.get("/nonexistent-path-12345")
        assert response.status_code == 404
