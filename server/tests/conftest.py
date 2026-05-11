"""
Pytest 配置文件 - 测试 fixtures 和共享配置
"""
import pytest
import asyncio
import httpx
from typing import AsyncGenerator, Dict
from datetime import datetime, timedelta
import asyncpg

# 测试数据库配置
TEST_DATABASE_URL = "postgresql://test_user:test_pass@localhost:5432/bidding_test"

# API 基础 URL
BASE_URL = "http://localhost:3001/api"


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def db_pool():
    """创建数据库连接池"""
    pool = await asyncpg.create_pool(TEST_DATABASE_URL, min_size=1, max_size=10)
    yield pool
    await pool.close()


@pytest.fixture(autouse=True)
async def clean_database(db_pool):
    """每个测试前清理数据库"""
    async with db_pool.acquire() as conn:
        # 清理测试数据（保留基础数据）
        await conn.execute("""
            TRUNCATE TABLE evaluations, bids, evaluation_committees, 
            judges, tenders, operation_logs, announcements RESTART IDENTITY CASCADE
        """)
    yield


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """创建 HTTP 客户端"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        yield client


@pytest.fixture
async def admin_token(client) -> str:
    """获取管理员 token"""
    response = await client.post("/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200
    return response.json()["data"]["token"]


@pytest.fixture
async def admin_headers(admin_token) -> Dict[str, str]:
    """管理员请求头"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
async def supplier_user(client, admin_headers):
    """创建供应商用户"""
    response = await client.post("/suppliers", json={
        "username": "test_supplier",
        "password": "supplier123",
        "real_name": "测试供应商",
        "company_name": "测试科技有限公司",
        "phone": "13800138000",
        "email": "supplier@test.com"
    }, headers=admin_headers)
    
    if response.status_code == 400 and "已存在" in response.text:
        # 用户已存在，直接获取
        response = await client.get("/suppliers", headers=admin_headers)
        users = response.json()["data"]["list"]
        for user in users:
            if user["username"] == "test_supplier":
                return user
    
    return response.json()["data"]


@pytest.fixture
async def supplier_token(client, supplier_user) -> str:
    """获取供应商 token"""
    response = await client.post("/auth/login", json={
        "username": "test_supplier",
        "password": "supplier123"
    })
    assert response.status_code == 200
    return response.json()["data"]["token"]


@pytest.fixture
async def supplier_headers(supplier_token) -> Dict[str, str]:
    """供应商请求头"""
    return {"Authorization": f"Bearer {supplier_token}"}


@pytest.fixture
async def judge_user(client, admin_headers):
    """创建评委用户"""
    response = await client.post("/judges", json={
        "username": "test_judge",
        "password": "judge123",
        "real_name": "测试评委",
        "specialty": "工程技术",
        "title": "高级工程师",
        "phone": "13900139000"
    }, headers=admin_headers)
    
    if response.status_code == 400 and "已存在" in response.text:
        response = await client.get("/judges", headers=admin_headers)
        judges = response.json()["data"]
        for judge in judges:
            if judge["username"] == "test_judge":
                return judge
    
    return response.json()["data"]


@pytest.fixture
async def judge_token(client, judge_user) -> str:
    """获取评委 token"""
    response = await client.post("/auth/login", json={
        "username": "test_judge",
        "password": "judge123"
    })
    assert response.status_code == 200
    return response.json()["data"]["token"]


@pytest.fixture
async def judge_headers(judge_token) -> Dict[str, str]:
    """评委请求头"""
    return {"Authorization": f"Bearer {judge_token}"}


@pytest.fixture
async def sample_tender(client, admin_headers):
    """创建示例招标项目"""
    tender_data = {
        "title": "测试招标项目",
        "project_number": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "category": "IT设备",
        "budget": 1000000,
        "description": "这是一个测试招标项目",
        "requirements": "技术要求...",
        "qualification_requirements": "资质要求...",
        "bid_deadline": (datetime.now() + timedelta(days=7)).isoformat(),
        "open_bid_date": (datetime.now() + timedelta(days=8)).isoformat()
    }
    
    response = await client.post("/tenders", json=tender_data, headers=admin_headers)
    assert response.status_code == 200
    return response.json()["data"]


@pytest.fixture
async def published_tender(client, admin_headers, sample_tender):
    """发布招标项目"""
    response = await client.put(
        f"/tenders/{sample_tender['id']}/publish",
        headers=admin_headers
    )
    assert response.status_code == 200
    
    # 获取更新后的招标信息
    response = await client.get(f"/tenders/{sample_tender['id']}", headers=admin_headers)
    return response.json()["data"]


@pytest.fixture
async def sample_bid(client, supplier_headers, published_tender):
    """创建示例投标"""
    bid_data = {
        "tender_id": published_tender["id"],
        "bid_price": 950000,
        "technical_proposal": "技术方案...",
        "business_proposal": "商务方案..."
    }
    
    response = await client.post("/bids", json=bid_data, headers=supplier_headers)
    assert response.status_code == 200
    return response.json()["data"]


# 辅助函数
def assert_success_response(response, expected_code=200):
    """断言成功响应"""
    assert response.status_code == expected_code
    data = response.json()
    assert data.get("code") == 200
    return data


def assert_error_response(response, expected_status, expected_code=None):
    """断言错误响应"""
    assert response.status_code == expected_status
    if expected_code:
        data = response.json()
        assert data.get("code") == expected_code
