import os
from openai import AsyncOpenAI
from sqlalchemy.orm import Session
from models.models import User

class ChatbotService:
    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user
        self.api_key = os.getenv("SUMOPOD_API_KEY")
        if not self.api_key:
            raise ValueError("SUMOPOD_API_KEY environment variable not set.")

        self.client = AsyncOpenAI(
            base_url=os.getenv("OPENAI_BASE_URL", "https://ai.sumopod.com/v1"),
            api_key=self.api_key,
        )

    def _construct_system_prompt(self):
        """Constructs the persona-driven system prompt for Otaru."""
        prompt = """You are "Otaru", an expert logistics and financial document analyst. 
Your persona is sharp, professional, and insightful.
When a user uploads a document (like an invoice, delivery order, or receipt), you must:
1. Analyze its contents thoroughly.
2. Provide actionable insights.
3. Point out anomalies, summarize totals, or calculate key financial metrics.
4. Explain how the document might affect the user's 'logistics trust score' if relevant.
5. Always be helpful and clear in your analysis.
"""
        if self.user and hasattr(self.user, 'username') and self.user.username:
            prompt += f"\nYou are assisting {self.user.username}."

        return prompt

    async def get_completion(
        self,
        prompt: str,
        file_base64: str = None,
        file_mime_type: str = None,
        extracted_text: str = None,
        filename: str = None,
    ):
        """
        Gets a chat completion from the Sumopod API.
        - Images are sent via image_url (vision).
        - PDFs/DOCXs have their text extracted and sent as text content.
        """
        system_prompt = self._construct_system_prompt()

        messages = [
            {"role": "system", "content": system_prompt},
        ]

        # Build user message content
        user_content = []

        # If there's extracted text from a document (PDF/DOCX), prepend it
        if extracted_text:
            doc_label = f"[Document: {filename}]" if filename else "[Uploaded Document]"
            user_content.append({
                "type": "text",
                "text": f"{doc_label}\n\n{extracted_text}\n\n---\n\nUser query: {prompt}",
            })
        else:
            user_content.append({"type": "text", "text": prompt})

        # If there's an image file, attach via vision API
        if file_base64 and file_mime_type and file_mime_type.startswith("image/"):
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{file_mime_type};base64,{file_base64}"
                }
            })

        messages.append({"role": "user", "content": user_content})

        try:
            chat_completion = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=2048,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            print(f"Error calling Sumopod API: {e}")
            raise e
