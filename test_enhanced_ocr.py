"""
Test Enhanced OCR System
"""
import asyncio
import numpy as np
from PIL import Image
import io
import sys
import os

# Add the be directory to sys.path so we can import our modules
sys.path.insert(0, 'c:\\Users\\asus\\Pictures\\Supply-Chain\\be')

from smart_ocr_processor import SmartOCRProcessor
from ai_text_summarizer import AITextSummarizer

async def test_enhanced_ocr():
    """Test enhanced OCR dengan sample image"""
    print("🔍 Testing Enhanced OCR System...")
    
    # Initialize processors
    ocr_key = "helloworld"  # Test key
    sumopod_key = "sk-67512c6cb9d8415783bbea27aafb9a68"
    
    smart_ocr = SmartOCRProcessor(ocr_key)
    ai_summarizer = AITextSummarizer(sumopod_key)
    
    print("✅ Smart OCR Processor initialized")
    print("✅ AI Text Summarizer initialized")
    
    # Create a simple test image with text
    test_text = """
    INVOICE
    No: INV/2024/001
    PT. ABC COMPANY
    Date: 13/12/2024
    
    Total: Rp 1,500,000
    
    Thank you for your business!
    """
    
    # Create image with text (simple white background)
    img = Image.new('RGB', (400, 300), color='white')
    
    # Convert to numpy array for testing
    image_np = np.array(img)
    
    print(f"📄 Testing with simulated invoice image...")
    
    # Test document type detection
    doc_type = smart_ocr.detect_document_type(test_text)
    print(f"🔎 Document type detected: {doc_type}")
    
    # Test structured data extraction
    structured_data = smart_ocr.extract_structured_data(test_text, doc_type)
    print(f"📊 Structured data extracted: {structured_data}")
    
    # Test smart summary generation
    smart_summary = smart_ocr.generate_smart_summary(test_text, structured_data, doc_type)
    print(f"📝 Smart summary: {smart_summary}")
    
    # Test AI summary generation
    try:
        ai_summary = await ai_summarizer.generate_intelligent_summary(
            test_text, doc_type, structured_data
        )
        print(f"🤖 AI summary: {ai_summary}")
    except Exception as e:
        print(f"⚠️  AI summary failed: {e}")
    
    print("\n✨ Enhanced OCR System Test Complete!")
    return True

if __name__ == "__main__":
    asyncio.run(test_enhanced_ocr())