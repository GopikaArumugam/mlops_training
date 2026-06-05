import os
from flask import Flask, render_template, request

from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

from transformers import pipeline
import re

# =========================
# APP CONFIG
# =========================

app = Flask(__name__)

DATA_PATH = r"D:\P\mlops\TASKS\DAY -15\JurisMind\data"

# =========================
# MODELS
# =========================

embedder = SentenceTransformer("all-MiniLM-L6-v2")

# FIXED PIPELINE (IMPORTANT)
llm = pipeline(
    "text-generation",
    model="google/flan-t5-base"
)

# =========================
# LOAD DOCUMENTS
# =========================

def load_documents():
    documents = []

    for root, dirs, files in os.walk(DATA_PATH):
        for file in files:
            if file.lower().endswith(".pdf"):
                path = os.path.join(root, file)

                try:
                    reader = PdfReader(path)
                    text = ""

                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text

                    documents.append({
                        "source": file,
                        "category": os.path.basename(root),
                        "text": text
                    })

                except:
                    pass

    return documents

# =========================
# CHUNKING
# =========================

def create_chunks(documents):

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100
    )

    chunks = []

    for doc in documents:
        doc_chunks = splitter.split_text(doc["text"])

        for chunk in doc_chunks:
            chunks.append({
                "text": chunk,
                "source": doc["source"],
                "category": doc["category"]
            })

    return chunks

# =========================
# BUILD VECTOR DB
# =========================

documents = load_documents()
print("Documents:", len(documents))

chunks = create_chunks(documents)
print("Chunks:", len(chunks))

texts = [c["text"] for c in chunks]

embeddings = embedder.encode(texts)
print("Embeddings shape:", embeddings.shape)

dimension = embeddings.shape[1]

os.makedirs("vector_db", exist_ok=True)
index_path = "vector_db/faiss.index"

if os.path.exists(index_path):
    index = faiss.read_index(index_path)
    print("Loaded saved FAISS index")

else:
    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(embeddings))

    faiss.write_index(index, index_path)
    print("FAISS index created and saved")

# =========================
# LLM FUNCTION
# =========================

def generate_answer(context, query):

    prompt = f"""
You are a strict legal AI assistant specialized in Indian law.

Rules:
- Use ONLY the relevant parts of the context.
- If context is not related, ignore it.
- Do NOT repeat instructions.
- Do NOT include system text.
- Give structured legal answer.

Format:
1. Issue
2. Relevant Law
3. Explanation
4. Conclusion

Context:
{context}

Question:
{query}

Answer:
"""

# =========================
# ROUTES
# =========================

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/ask", methods=["POST"])
def ask():

    query = request.form["query"]

    # FAISS SEARCH
    query_embedding = embedder.encode([query])
    D, I = index.search(np.array(query_embedding), k=5)

    retrieved_texts = []
    sources = set()

    for i in I[0]:
        retrieved_texts.append(chunks[i]["text"])
        sources.add(chunks[i]["source"])

    context = " ".join(retrieved_texts)

    # =========================
    # GENERATE ANSWER
    # =========================

    try:
        answer = generate_answer(context, query)

    except:
        # fallback method
        sentences = re.split(r'\.|\n', context)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 30]

        keywords = query.lower().split()

        ranked = sorted(
            sentences,
            key=lambda s: sum(1 for w in keywords if w in s.lower()),
            reverse=True
        )

        answer = ". ".join(ranked[:5])

    return f"""
Answer:
{answer}

\n\nSources:
{chr(10).join(list(sources))}
"""

# =========================
# RUN APP
# =========================

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)