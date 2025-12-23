"""
PPT Service - AI-Powered Presentation Generator
Converts scan data into professional PowerPoint presentations
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from openai import OpenAI
from config.settings import settings
import json
import os
from datetime import datetime
from typing import Dict, List, Any

class PPTService:
    """Service for generating PowerPoint presentations from scan data"""
    
    @staticmethod
    async def generate_from_prompt(
        prompt: str, 
        user_id: str, 
        image_data: List[str] = None
    ) -> Dict[str, str]:
        """
        Generate presentation from text prompt and optional images
        
        Args:
            prompt: User provided topic or instructions
            user_id: User requesting generation
            image_data: List of base64 encoded images (max 2)
        """
        try:
            # 1. Structure content using AI (Vision if images present)
            print(f"🤖 Structuring PPT from prompt: '{prompt}' with {len(image_data or [])} images")
            
            structured_content = await PPTService._structure_from_prompt(prompt, image_data)
            
            # 2. Build PowerPoint
            print("📊 Building PowerPoint presentation...")
            prs = Presentation()
            prs.slide_width = Inches(10)
            prs.slide_height = Inches(7.5)
            
            # Add slides based on AI structure
            PPTService._add_title_slide(prs, structured_content.get("title", "Presentation"))
            PPTService._add_summary_slide(prs, structured_content.get("summary", {}))
            
            # Add content slides
            for slide_data in structured_content.get("slides", []):
                if slide_data["type"] == "bullet":
                    PPTService._add_bullet_slide(prs, slide_data)
                elif slide_data["type"] == "table":
                    PPTService._add_table_slide(prs, slide_data)
            
            # 3. Save file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"prompt_{user_id}_{timestamp}.pptx"
            
            exports_dir = os.path.join("static", "exports")
            os.makedirs(exports_dir, exist_ok=True)
            
            file_path = os.path.join(exports_dir, filename)
            prs.save(file_path)
            
            # 4. Generate Viewer URL
            base_url = settings.base_url or "http://localhost:8000"
            ppt_url = f"{base_url}/static/exports/{filename}"
            viewer_url = f"https://view.officeapps.live.com/op/view.aspx?src={ppt_url}"
            
            return {
                "file_path": file_path,
                "download_url": ppt_url,
                "viewer_url": viewer_url,
                "filename": filename
            }
            
        except Exception as e:
            print(f"❌ PPT Prompt generation error: {str(e)}")
            raise Exception(f"Failed to generate presentation: {str(e)}")

    @staticmethod
    async def _structure_from_prompt(prompt: str, images: List[str] = None) -> Dict[str, Any]:
        """Use GPT-4o-mini Vision to structure presentation from prompt + images"""
        
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        system_prompt = """You are a top-tier Presentation Designer. 
Create a professional PowerPoint structure based on the user's prompt and any provided images.

Return ONLY valid JSON in this exact format:
{
  "title": "Presentation Title",
  "summary": {
    "overview": "Executive summary paragraph...",
    "key_points": ["Key takeaway 1", "Key takeaway 2"]
  },
  "slides": [
    {
      "type": "bullet",
      "title": "Slide Title",
      "points": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": []}
        ]
        
        # Add text prompt
        messages[1]["content"].append({
            "type": "text",
            "text": f"Create a presentation about: {prompt}"
        })
        
        # Add images if provided
        if images:
            for img_base64 in images:
                if img_base64.startswith('data:image'):
                    url = img_base64
                else:
                    url = f"data:image/jpeg;base64,{img_base64}"
                    
                messages[1]["content"].append({
                    "type": "image_url",
                    "image_url": {"url": url}
                })

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content.strip()
            return json.loads(content)
            
        except Exception as e:
            print(f"⚠️ AI structuring failed: {e}")
            raise Exception(f"AI generation failed: {str(e)}")

    @staticmethod
    async def generate_presentation(scan_id_or_data: Any, user_id: str) -> Dict[str, str]:
        # Legacy support wrapper
        if isinstance(scan_id_or_data, dict):
             return await PPTService.generate_from_prompt(
                 prompt=f"Create a report for this document: {scan_id_or_data.get('original_filename', 'Document')}", 
                 user_id=user_id
             )
        return await PPTService.generate_from_prompt("Generate generic report", user_id)
    
    @staticmethod
    def _add_title_slide(prs: Presentation, title: str):
        """Add title slide with modern design"""
        slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank layout
        
        # Add background color
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = RGBColor(26, 35, 126)  # Dark blue
        
        # Add title
        title_box = slide.shapes.add_textbox(
            Inches(1), Inches(2.5), Inches(8), Inches(1.5)
        )
        title_frame = title_box.text_frame
        title_frame.text = title
        
        p = title_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.font.size = Pt(44)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255)
        
        # Add subtitle
        subtitle_box = slide.shapes.add_textbox(
            Inches(1), Inches(4.5), Inches(8), Inches(0.5)
        )
        subtitle_frame = subtitle_box.text_frame
        subtitle_frame.text = f"Generated by PPT.wtf • {datetime.now().strftime('%B %d, %Y')}"
        
        p = subtitle_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.font.size = Pt(18)
        p.font.color.rgb = RGBColor(200, 200, 200)
    
    @staticmethod
    def _add_summary_slide(prs: Presentation, summary: Dict[str, Any]):
        """Add executive summary slide"""
        slide = prs.slides.add_slide(prs.slide_layouts[1])  # Title and content
        
        title = slide.shapes.title
        title.text = "Executive Summary"
        
        content = slide.placeholders[1]
        tf = content.text_frame
        tf.text = summary.get("overview", "")
        
        # Add key points
        for point in summary.get("key_points", []):
            p = tf.add_paragraph()
            p.text = point
            p.level = 1
            p.font.size = Pt(18)
    
    @staticmethod
    def _add_bullet_slide(prs: Presentation, slide_data: Dict[str, Any]):
        """Add bullet point slide"""
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        
        title = slide.shapes.title
        title.text = slide_data.get("title", "")
        
        content = slide.placeholders[1]
        tf = content.text_frame
        tf.clear()
        
        for point in slide_data.get("points", []):
            p = tf.add_paragraph()
            p.text = point
            p.font.size = Pt(20)
            p.space_before = Pt(12)
    
    @staticmethod
    def _add_table_slide(prs: Presentation, slide_data: Dict[str, Any]):
        """Add table slide"""
        slide = prs.slides.add_slide(prs.slide_layouts[5])  # Title only
        
        title = slide.shapes.title
        title.text = slide_data.get("title", "")
        
        # Add table (simplified for now)
        rows = len(slide_data.get("rows", [])) + 1
        cols = len(slide_data.get("headers", []))
        
        if rows > 1 and cols > 0:
            table = slide.shapes.add_table(
                rows, cols, Inches(1), Inches(2), Inches(8), Inches(4)
            ).table
            
            # Add headers
            for i, header in enumerate(slide_data.get("headers", [])):
                table.cell(0, i).text = header
            
            # Add data rows
            for row_idx, row_data in enumerate(slide_data.get("rows", [])):
                for col_idx, cell_data in enumerate(row_data):
                    table.cell(row_idx + 1, col_idx).text = str(cell_data)
