import os
import httpx

class MailService:
    def __init__(self, api_key, sender_email, sender_name):
        self.api_key = api_key
        self.sender_email = sender_email
        self.sender_name = sender_name
        self.base_url = "https://go2.unisender.ru/ru/transactional/api/v1/email/send.json"

    def send_email(self, to_email, subject, html_content):
        if not os.getenv("ENABLE_EMAIL", "false").lower() == "true":
            print(f"[SIMULATED] Email to {to_email}: {subject}")
            print(f"[SIMULATED] Content:\n{html_content}")
            return {"status": "simulated"}
        # if not to_email.endswith("@polkamarket.ru"):
        #     print(f"[BLOCKED] Email to {to_email} — only @polkamarket.ru allowed")
        #     return {"status": "blocked"}
        payload = {
            "message": {
                "recipients": [{"email": to_email}],
                "subject": subject,
                "from_email": self.sender_email,
                "from_name": self.sender_name,
                "body": {"html": html_content},
            }
        }
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-API-KEY": self.api_key,
        }
        print(f"[MAIL] Using API key: {self.api_key[:8]}...{self.api_key[-4:] if self.api_key else 'None'}")
        try:
            response = httpx.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            print(f"Email to {to_email} | subject: {subject} | body: {html_content} | response: {result}")
            return result
        except httpx.HTTPStatusError as e:
            print(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
            return None
        except httpx.RequestError as e:
            print(f"An error occurred while requesting {e.request.url!r}: {e}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            return None

    def send_brand_welcome_email(self, email, brand_name, temp_password):
        subject = "Polka — Данные для входа в аккаунт бренда"
        html_content = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Добро пожаловать в Polka!</h2>
            <p>Для бренда <strong>{brand_name}</strong> создан аккаунт.</p>
            <p>Данные для входа:</p>
            <p><strong>Email:</strong> {email}<br/>
            <strong>Пароль:</strong> {temp_password}</p>
            <p>Рекомендуем сменить пароль после первого входа.</p>
        </div>
        """
        return self.send_email(email, subject, html_content)


mail_service = MailService(
    os.getenv("UNISENDER_API_KEY"),
    os.getenv("UNISENDER_FROM_EMAIL"),
    os.getenv("UNISENDER_FROM_NAME"),
)
