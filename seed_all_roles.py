
import sys
import os
import uuid
import logging

# Setup environment
sys.path.insert(0, '.')
os.environ.setdefault('POSTGRES_SERVER', 'localhost')
os.environ.setdefault('POSTGRES_PORT', '5434')
os.environ.setdefault('POSTGRES_USER', 'postgres')
os.environ.setdefault('POSTGRES_PASSWORD', 'change_this_password_in_prod')
os.environ.setdefault('POSTGRES_DB', 'ajust_hub')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base_class import Base
from app.models.tenants import User, Tenant
from app.core.security import get_password_hash

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
url = 'postgresql://postgres:change_this_password_in_prod@localhost:5434/ajust_hub'
engine = create_engine(url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_users():
    db = SessionLocal()
    try:
        # Ensure a default tenant exists
        tenant = db.query(Tenant).filter_by(slug='ajust-hq').first()
        if not tenant:
            logger.info("Creating default tenant 'Ajust HQ'")
            tenant = Tenant(
                name="Ajust HQ",
                slug="ajust-hq",
                cpf_cnpj="00000000000000"
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        # Define users to create
        users_to_create = [
            {"email": "analyst@ajust.com", "password": "123", "role": "analyst", "name": "Analista Geral"},
            {"email": "noc@ajust.com", "password": "123", "role": "noc_engineer", "name": "Engenheiro NOC"},
            {"email": "sac@ajust.com", "password": "123", "role": "sac_agent", "name": "Atendente SAC"},
            {"email": "cliente@ajust.com", "password": "123", "role": "isp_owner", "name": "Dono do Provedor"},
            {"email": "admin@ajust.com", "password": "123", "role": "super_admin", "name": "Super Admin"},
        ]

        created_users = []

        for user_data in users_to_create:
            user = db.query(User).filter_by(email=user_data["email"]).first()
            if not user:
                logger.info(f"Creating user {user_data['email']} ({user_data['role']})")
                new_user = User(
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    role=user_data["role"],
                    name=user_data["name"],
                    tenant_id=tenant.id
                )
                db.add(new_user)
                created_users.append(user_data)
            else:
                logger.info(f"User {user_data['email']} already exists. Updating password to 123 for convenience.")
                user.hashed_password = get_password_hash(user_data["password"])
                created_users.append(user_data)
        
        db.commit()
        
        print("\n" + "="*60)
        print("✅ USERS READY FOR LOGIN:")
        print("="*60)
        print(f"{'ROLE':<15} | {'EMAIL':<25} | {'PASSWORD'}")
        print("-" * 60)
        for u in created_users:
             print(f"{u['role']:<15} | {u['email']:<25} | {u['password']}")
        print("="*60 + "\n")

    except Exception as e:
        logger.error(f"Error creating users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_users()
