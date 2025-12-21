"""
Setup script for Backend
"""
import subprocess
import sys
import os

def main():
    print("🚀 Setting up OCR.WTF Backend...")
    
    # Check Python version
    if sys.version_info < (3, 10):
        print("❌ Python 3.10+ is required")
        sys.exit(1)
    
    print("✅ Python version OK")
    
    # Create virtual environment
    print("\n📦 Creating virtual environment...")
    subprocess.run([sys.executable, "-m", "venv", "venv"])
    print("✅ Virtual environment created")
    
    # Determine pip path
    if os.name == 'nt':  # Windows
        pip_path = os.path.join("venv", "Scripts", "pip.exe")
    else:  # Unix
        pip_path = os.path.join("venv", "bin", "pip")
    
    # Install dependencies
    print("\n📥 Installing dependencies...")
    subprocess.run([pip_path, "install", "-r", "requirements.txt"])
    print("✅ Dependencies installed")
    
    # Create uploads directory
    print("\n📁 Creating uploads directory...")
    os.makedirs("uploads", exist_ok=True)
    print("✅ Uploads directory created")
    
    # Check .env file
    if not os.path.exists("../.env"):
        print("\n⚠️  Warning: .env file not found!")
        print("   Please copy .env.example to .env and fill in your values")
    else:
        print("\n✅ .env file found")
    
    print("\n✨ Backend setup complete!")
    print("\nNext steps:")
    print("1. Activate virtual environment:")
    if os.name == 'nt':
        print("   .\\venv\\Scripts\\Activate.ps1")
    else:
        print("   source venv/bin/activate")
    print("2. Run the server:")
    print("   python main.py")
    print("3. Visit: http://localhost:8000/api/docs")

if __name__ == "__main__":
    main()
