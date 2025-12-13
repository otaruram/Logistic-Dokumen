#!/usr/bin/env python3
"""
Startup script for Supply Chain OCR Backend
Checks dependencies and starts the server
"""

import subprocess
import sys
import os
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        return False
    print(f"✅ Python {sys.version.split()[0]} is compatible")
    return True

def check_environment():
    """Check if .env file exists"""
    if not os.path.exists('.env'):
        print("⚠️  .env file not found")
        print("💡 Copy .env.example to .env and configure your settings")
        return False
    print("✅ .env file found")
    return True

def install_dependencies():
    """Install required dependencies"""
    print("📦 Installing dependencies...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], check=True)
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        return False

def setup_database():
    """Setup database schema"""
    print("🗄️  Setting up database...")
    try:
        # Generate Prisma client
        subprocess.run(["prisma", "generate"], check=True)
        print("✅ Prisma client generated")
        
        # Push schema to database
        subprocess.run(["prisma", "db", "push"], check=True)
        print("✅ Database schema updated")
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Database setup failed: {e}")
        print("💡 Make sure your DATABASE_URL is correct in .env")
        return False

def start_server():
    """Start the FastAPI server"""
    print("🚀 Starting server...")
    try:
        subprocess.run(["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"])
    except KeyboardInterrupt:
        print("\n👋 Server stopped")

def main():
    """Main startup routine"""
    print("🔧 Supply Chain OCR Backend - Startup Script")
    print("=" * 50)
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    print(f"📁 Working directory: {script_dir}")
    
    # Run checks
    checks = [
        check_python_version(),
        check_environment(),
        install_dependencies(),
        setup_database()
    ]
    
    if all(checks):
        print("\n🎉 All checks passed! Starting server...")
        start_server()
    else:
        print("\n💥 Some checks failed. Please fix the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()