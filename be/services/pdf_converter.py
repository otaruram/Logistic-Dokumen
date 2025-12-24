"""
PDF Converter Service
Converts PPTX files to PDF using LibreOffice headless mode
"""
import subprocess
import os
from pathlib import Path
from typing import Optional

class PDFConverter:
    """Service for converting PPTX to PDF"""
    
    @staticmethod
    def convert_pptx_to_pdf(pptx_path: str, output_dir: Optional[str] = None) -> str:
        """
        Convert PPTX file to PDF using LibreOffice headless
        
        Args:
            pptx_path: Path to PPTX file
            output_dir: Output directory for PDF (default: same as PPTX)
            
        Returns:
            Path to generated PDF file
            
        Raises:
            Exception: If conversion fails
        """
        try:
            # Validate input file
            if not os.path.exists(pptx_path):
                raise FileNotFoundError(f"PPTX file not found: {pptx_path}")
            
            # Determine output directory
            if output_dir is None:
                output_dir = os.path.dirname(pptx_path)
            
            # Ensure output directory exists
            os.makedirs(output_dir, exist_ok=True)
            
            print(f"🔄 Converting PPTX to PDF: {pptx_path}")
            
            # Try LibreOffice first
            try:
                result = PDFConverter._convert_with_libreoffice(pptx_path, output_dir)
                if result:
                    return result
            except Exception as e:
                print(f"⚠️ LibreOffice conversion failed: {e}")
            
            # Fallback to unoconv
            try:
                result = PDFConverter._convert_with_unoconv(pptx_path, output_dir)
                if result:
                    return result
            except Exception as e:
                print(f"⚠️ Unoconv conversion failed: {e}")
            
            raise Exception("All PDF conversion methods failed. Please install LibreOffice or unoconv.")
            
        except Exception as e:
            print(f"❌ PDF conversion error: {str(e)}")
            raise
    
    @staticmethod
    def _convert_with_libreoffice(pptx_path: str, output_dir: str) -> Optional[str]:
        """Convert using LibreOffice headless mode"""
        try:
            # Try common LibreOffice paths
            libreoffice_paths = [
                "libreoffice",  # Linux/Mac
                "/usr/bin/libreoffice",  # Linux
                "/Applications/LibreOffice.app/Contents/MacOS/soffice",  # Mac
                "C:\\Program Files\\LibreOffice\\program\\soffice.exe",  # Windows
                "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",  # Windows 32-bit
            ]
            
            libreoffice_cmd = None
            for path in libreoffice_paths:
                if os.path.exists(path) or subprocess.run(["which", path], capture_output=True).returncode == 0:
                    libreoffice_cmd = path
                    break
            
            if not libreoffice_cmd:
                # Try without full path
                libreoffice_cmd = "libreoffice"
            
            # Run conversion
            cmd = [
                libreoffice_cmd,
                "--headless",
                "--convert-to", "pdf",
                "--outdir", output_dir,
                pptx_path
            ]
            
            print(f"🚀 Running: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60  # 60 second timeout
            )
            
            if result.returncode != 0:
                raise Exception(f"LibreOffice failed: {result.stderr}")
            
            # Calculate PDF filename
            pptx_filename = os.path.basename(pptx_path)
            pdf_filename = os.path.splitext(pptx_filename)[0] + ".pdf"
            pdf_path = os.path.join(output_dir, pdf_filename)
            
            if os.path.exists(pdf_path):
                print(f"✅ PDF created: {pdf_path}")
                return pdf_path
            else:
                raise Exception("PDF file not created")
                
        except Exception as e:
            print(f"LibreOffice conversion error: {e}")
            return None
    
    @staticmethod
    def _convert_with_unoconv(pptx_path: str, output_dir: str) -> Optional[str]:
        """Convert using unoconv"""
        try:
            cmd = [
                "unoconv",
                "-f", "pdf",
                "-o", output_dir,
                pptx_path
            ]
            
            print(f"🚀 Running: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                raise Exception(f"Unoconv failed: {result.stderr}")
            
            # Calculate PDF filename
            pptx_filename = os.path.basename(pptx_path)
            pdf_filename = os.path.splitext(pptx_filename)[0] + ".pdf"
            pdf_path = os.path.join(output_dir, pdf_filename)
            
            if os.path.exists(pdf_path):
                print(f"✅ PDF created: {pdf_path}")
                return pdf_path
            else:
                raise Exception("PDF file not created")
                
        except Exception as e:
            print(f"Unoconv conversion error: {e}")
            return None
    
    @staticmethod
    def get_pdf_filename(pptx_filename: str) -> str:
        """Get PDF filename from PPTX filename"""
        return os.path.splitext(pptx_filename)[0] + ".pdf"
