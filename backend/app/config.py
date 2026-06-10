import os
from pydantic_settings import BaseSettings, SettingsConfigDict

# Vercel serverless has a read-only filesystem; SQLite must go to /tmp
_default_db = "sqlite:////tmp/interview_generator.db" if os.environ.get("VERCEL") else "sqlite:///./interview_generator.db"

class Settings(BaseSettings):
    DATABASE_URL: str = _default_db
    SECRET_KEY: str = "super_secret_key_for_ai_project_interview_generator_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"  # Fallback to 1.5-flash if 2.5 is not accessible, can be configured in env
    
    # Allow loading from a .env file if it exists
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    
    def __init__(self, **values):
        super().__init__(**values)
        # SQLAlchemy 1.4+ deprecated 'postgres://' in favor of 'postgresql://'
        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql://", 1)

settings = Settings()
