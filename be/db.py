from prisma import Prisma

# Global Prisma Client Instance
prisma = Prisma()

async def connect_db():
    """Helper untuk konek database"""
    if not prisma.is_connected():
        await prisma.connect()

async def disconnect_db():
    """Helper untuk putus koneksi"""
    if prisma.is_connected():
        await prisma.disconnect()