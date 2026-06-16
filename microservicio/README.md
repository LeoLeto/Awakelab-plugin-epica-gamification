# Memory3D Microservice

FastAPI microservice for:
- extracting text from PDFs
- generating short question/answer pairs with OpenAI
- optionally storing extracted data and generated pairs in MongoDB

## Endpoints

- `POST /api/pairs`
  - JSON input for plain text
  - compatible with current Moodle `mod_memory3d` backend call

- `POST /api/pairs_from_pdf`
  - multipart upload of a PDF file
  - extracts text, generates pairs, optionally stores in MongoDB

- `POST /api/extract`
  - multipart upload of PDF
  - extracts text and chunks only (no pair generation)

## Local run

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Render start command

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```
