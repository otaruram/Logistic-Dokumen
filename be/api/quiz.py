"""
Quiz API routes - AI-powered Quiz Generator
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
import json
from nanoid import generate
from utils.auth import get_current_user, supabase, supabase_admin
from config.settings import settings
import PyPDF2
import io

router = APIRouter()

# Initialize OpenAI client for Quiz (using Sumopod proxy)
client = OpenAI(
    api_key=settings.QUIZ_OPENAI_API_KEY,
    base_url=settings.QUIZ_BASE_URL
)

# --- MODELS ---
class QuizGenerateRequest(BaseModel):
    topic: str
    num_questions: Optional[int] = 20  # Default 20, max 50
    pdf_context: Optional[str] = None  # Extracted text from PDF
    
class QuizOption(BaseModel):
    text: str
    isCorrect: bool
    
class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[QuizOption]
    explanation: str

class QuizData(BaseModel):
    title: str
    questions: List[QuizQuestion]

# --- GENERATE QUIZ ---
@router.post("/generate")
async def generate_quiz(request: QuizGenerateRequest, user = Depends(get_current_user)):
    """
    Generate AI-powered quiz using GPT-4
    """
    try:
        topic = request.topic.strip()
        if not topic or len(topic) < 3:
            raise HTTPException(status_code=400, detail="Topic harus minimal 3 karakter")
        
        # Validate and set question count
        num_questions = min(50, max(5, request.num_questions or 20))
        
        # Check if PDF context is provided
        pdf_context = request.pdf_context or ""
            
        print(f"🎯 Generating quiz: {topic} ({num_questions} questions)")
        
        # Call OpenAI API
        system_prompt = f"""You are an expert academic professor. Create a high-quality quiz with challenging, accurate, and diverse questions based on the latest curriculum.
        
IMPORTANT RULES:
1. Create EXACTLY {num_questions} questions in Indonesian
2. Each question must have 4 answer options
3. ONLY 1 correct answer (isCorrect: true)
4. Provide in-depth explanation for each answer
5. Questions should be progressive (easy to difficult)
6. Avoid ambiguous questions
7. Use VALID JSON format
8. Base content on updated curriculum (2024-2025)"""

        pdf_instruction = f"\n\nBASED ON THIS DOCUMENT CONTENT:\n{pdf_context}\n\nGenerate questions from the document above." if pdf_context else ""
        
        user_prompt = f"""Create an interactive quiz about: "{topic}"{pdf_instruction}

REQUIRED JSON format:
{{
  "title": "Kuis: [Topik]",
  "questions": [
    {{
      "id": 1,
      "question": "Pertanyaan yang jelas dan spesifik?",
      "options": [
        {{"text": "Pilihan A", "isCorrect": false}},
        {{"text": "Pilihan B", "isCorrect": true}},
        {{"text": "Pilihan C", "isCorrect": false}},
        {{"text": "Pilihan D", "isCorrect": false}}
      ],
      "explanation": "Penjelasan mendalam mengapa jawaban B benar..."
    }}
  ]
}}

PENTING: Buat TEPAT 20 pertanyaan seperti contoh di atas."""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4000,
            response_format={"type": "json_object"}  # Memastikan output selalu JSON
        )
        
        # Parse response (new style: use dot notation)
        ai_content = response.choices[0].message.content.strip()
        
        # Extract JSON from markdown code blocks if present
        if "```json" in ai_content:
            ai_content = ai_content.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_content:
            ai_content = ai_content.split("```")[1].split("```")[0].strip()
            
        quiz_data = json.loads(ai_content)
        
        # Validate structure
        if "questions" not in quiz_data or len(quiz_data["questions"]) != num_questions:
            raise ValueError(f"Invalid quiz structure: Expected {num_questions} questions, got {len(quiz_data.get('questions', []))}")
        
        # Get user ID
        user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid session")
        user_id_str = str(user_id)
        
        # Deduct 1 credit for quiz generation
        from api.tools import deduct_user_credit, log_activity
        await deduct_user_credit(user_id_str, 1)
        
        # Generate unique ID
        quiz_id = generate(size=7)
        
        # Save to Supabase
        db_record = {
            "id": quiz_id,
            "topic": topic,
            "title": quiz_data["title"],
            "questions": quiz_data["questions"],
            "user_id": user_id_str,
            "created_at": "now()"
        }
        
        result = supabase_admin.table("quizzes").insert(db_record).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save quiz to database")
        
        # Log activity
        await log_activity(user_id_str, "quiz", "generate", {"quiz_id": quiz_id, "topic": topic, "questions": num_questions, "has_pdf": bool(pdf_context)})
        
        print(f"✅ Quiz generated successfully: {quiz_id}")
        
        return {
            "success": True,
            "redirectUrl": f"/play/{quiz_id}",
            "quizId": quiz_id
        }
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {e}")
        raise HTTPException(status_code=500, detail="AI response format invalid")
    except Exception as e:
        print(f"❌ Generate Quiz Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")

# --- GET QUIZ BY ID ---
@router.get("/play/{quiz_id}")
async def get_quiz(quiz_id: str):
    """
    Retrieve quiz data for playing
    """
    try:
        result = supabase_admin.table("quizzes").select("*").eq("id", quiz_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Quiz not found")
        
        quiz = result.data[0]
        
        # SECURITY: Remove isCorrect from options to prevent cheating via Network tab
        sanitized_questions = []
        for question in quiz["questions"]:
            sanitized_options = [
                {"text": opt["text"]} for opt in question["options"]
            ]
            sanitized_questions.append({
                "id": question["id"],
                "question": question["question"],
                "options": sanitized_options,
                # Don't send explanation yet (will be revealed after answer)
            })
        
        return {
            "id": quiz["id"],
            "topic": quiz["topic"],
            "title": quiz["title"],
            "questions": sanitized_questions,
            "createdAt": quiz["created_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get Quiz Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve quiz")

# --- VALIDATE SINGLE ANSWER ---
class ValidateAnswerRequest(BaseModel):
    answer: str

@router.post("/validate/{quiz_id}/{question_id}")
async def validate_answer(quiz_id: str, question_id: int, request: ValidateAnswerRequest):
    """
    Validate a single answer immediately and return feedback
    """
    try:
        # Get quiz from DB
        result = supabase_admin.table("quizzes").select("*").eq("id", quiz_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Quiz not found")
        
        quiz = result.data[0]
        questions = quiz["questions"]
        
        # Find the question
        question = next((q for q in questions if q["id"] == question_id), None)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Find correct answer
        correct_option = next((opt for opt in question["options"] if opt.get("isCorrect")), None)
        if not correct_option:
            raise HTTPException(status_code=500, detail="Question has no correct answer")
        
        is_correct = request.answer == correct_option["text"]
        
        return {
            "isCorrect": is_correct,
            "correctAnswer": correct_option["text"],
            "explanation": question.get("explanation", "No explanation available")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Validate Answer Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate answer")

# --- SUBMIT ANSWERS ---
@router.post("/submit/{quiz_id}")
async def submit_quiz(quiz_id: str, answers: dict):
    """
    Validate answers and return score
    """
    try:
        # Get quiz from DB
        result = supabase_admin.table("quizzes").select("*").eq("id", quiz_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Quiz not found")
        
        quiz = result.data[0]
        questions = quiz["questions"]
        
        # Calculate score
        correct_count = 0
        total_questions = len(questions)
        results = []
        
        for question in questions:
            question_id = question["id"]
            user_answer = answers.get(str(question_id))
            
            # Find correct answer
            correct_option = next((opt for opt in question["options"] if opt["isCorrect"]), None)
            is_correct = user_answer == correct_option["text"] if correct_option else False
            
            if is_correct:
                correct_count += 1
            
            results.append({
                "questionId": question_id,
                "isCorrect": is_correct,
                "correctAnswer": correct_option["text"] if correct_option else None,
                "explanation": question["explanation"]
            })
        
        score = (correct_count / total_questions) * 100
        
        return {
            "score": round(score, 2),
            "correct": correct_count,
            "total": total_questions,
            "results": results
        }
        
    except Exception as e:
        print(f"❌ Submit Quiz Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit quiz")

# --- EXTRACT TEXT FROM PDF ---
@router.post("/extract-pdf")
async def extract_pdf_text(file: UploadFile = File(...)):
    """
    Extract text from uploaded PDF file for quiz generation
    """
    try:
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be PDF")
        
        # Read PDF content
        content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        
        # Extract text from all pages (limit to 50 pages)
        extracted_text = ""
        max_pages = min(len(pdf_reader.pages), 50)
        
        for page_num in range(max_pages):
            page = pdf_reader.pages[page_num]
            extracted_text += page.extract_text() + "\\n\\n"
        
        # Limit text to 8000 characters to fit in GPT context
        if len(extracted_text) > 8000:
            extracted_text = extracted_text[:8000] + "... (truncated)"
        
        print(f"✅ PDF extracted: {len(extracted_text)} characters from {max_pages} pages")
        
        return {
            "success": True,
            "text": extracted_text,
            "pages": max_pages
        }
        
    except Exception as e:
        print(f"❌ PDF extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract PDF: {str(e)}")

# --- GET USER'S QUIZ HISTORY ---
@router.get("/history")
async def get_quiz_history(user = Depends(get_current_user)):
    """
    Get user's quiz history
    """
    try:
        result = supabase_admin.table("quizzes")\
            .select("id, topic, title, created_at")\
            .eq("user_id", str(user.id))\
            .order("created_at", desc=True)\
            .limit(20)\
            .execute()
        
        return result.data or []
        
    except Exception as e:
        print(f"❌ Get History Error: {e}")
        return []
