from langchain_text_splitters import RecursiveCharacterTextSplitter

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