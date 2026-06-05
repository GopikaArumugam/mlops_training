import os
from pypdf import PdfReader

def load_documents(root_folder):

    documents = []

    for root, dirs, files in os.walk(root_folder):

        for file in files:

            if file.lower().endswith(".pdf"):

                path = os.path.join(root, file)

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

    return documents