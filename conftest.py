import os

# Force an isolated in-memory SQLite DB for the test process. Must run before
# app.config / app.db are imported. Production uses Postgres via DATABASE_URL.
os.environ["DATABASE_URL"] = "sqlite://"
