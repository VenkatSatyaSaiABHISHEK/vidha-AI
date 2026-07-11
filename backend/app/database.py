from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import DATABASE_URL

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Needed for SQLite multi-thread FastAPI
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Context provider yield for database queries."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initializes tables on startup."""
    from .models import database_models
    Base.metadata.create_all(bind=engine)
    
    # Try adding collection_id column to chat_sessions table if it doesn't exist
    from sqlalchemy import text
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE chat_sessions ADD COLUMN collection_id VARCHAR"))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

    # Pre-seed default Subjects (Collections)
    db = SessionLocal()
    try:
        from .models.database_models import Collection, Document
        from .services.rag_engine import RagEngine
        default_subjects = [
            ("python-dsa", "Python & DSA", "Python programming notes, data structures, and algorithms interview preparation materials.", "Cpu"),
            ("dbms-os", "DBMS & Operating Systems", "Database management systems SQL queries, indexing, and OS process scheduling/concurrency notes.", "Layers"),
            ("java-oop", "Java & OOP Core", "Object-Oriented programming concepts in Java, classes, inheritance, polymorphism, and design patterns.", "BookOpen")
        ]
        for sid, name, desc, icon in default_subjects:
            exists = db.query(Collection).filter(Collection.id == sid).first()
            if not exists:
                subj = Collection(id=sid, name=name, description=desc, icon_type=icon)
                db.add(subj)
                
                # Add a sample study document for each pre-seeded subject
                if sid == "python-dsa":
                    doc = Document(
                        id=f"doc-sample-{sid}",
                        name="Python_DSA_Interview_Prep.txt",
                        size="1.2 KB",
                        type="txt",
                        status="Indexed",
                        summary="Overview of Python lists, decorators, and Big-O complexity for basic sorting algorithms.",
                        ocr_text="Python Interview Study Notes:\n\n1. Decorators: A decorator is a design pattern in Python that allows a user to add new functionality to an existing object without modifying its structure. It is syntactically represented by prefixing a function with @decorator_name.\n\n2. Big-O Complexity:\n- O(1): Constant Time\n- O(log n): Logarithmic Time (Binary Search)\n- O(n): Linear Time (Linear search)\n- O(n log n): Merge Sort, Quick Sort\n- O(n^2): Bubble Sort, Insertion Sort\n\n3. Lists: Python lists are ordered, mutable, and allow duplicate elements.",
                        collection_id=sid
                    )
                    db.add(doc)
                    db.commit()
                    # Index in ChromaDB
                    try:
                        RagEngine.index_document(doc.id, doc.name, [(1, doc.ocr_text)], sid)
                    except Exception as ve:
                        print(f"Error vector indexing python-dsa: {ve}")
                elif sid == "dbms-os":
                    doc = Document(
                        id=f"doc-sample-{sid}",
                        name="DBMS_OS_Core_Concepts.txt",
                        size="1.5 KB",
                        type="txt",
                        status="Indexed",
                        summary="Relational database normalization (1NF, 2NF, 3NF) and CPU scheduling algorithms (Round Robin, FIFO).",
                        ocr_text="DBMS and Operating Systems Review:\n\n1. Normalization Forms:\n- 1NF: Atomic values only. No repeating groups.\n- 2NF: In 1NF + all non-key attributes fully functional dependent on primary key.\n- 3NF: In 2NF + no transitive dependency.\n\n2. CPU Scheduling:\n- First-Come, First-Served (FCFS): Non-preemptive scheduling based on arrival order.\n- Shortest Job First (SJF): Non-preemptive scheduling based on shortest burst time.\n- Round Robin (RR): Preemptive scheduling with a fixed time slice quantum.\n\n3. Indexes: Database indexes speed up queries by avoiding scanning every row in a table.",
                        collection_id=sid
                    )
                    db.add(doc)
                    db.commit()
                    # Index in ChromaDB
                    try:
                        RagEngine.index_document(doc.id, doc.name, [(1, doc.ocr_text)], sid)
                    except Exception as ve:
                        print(f"Error vector indexing dbms-os: {ve}")
                elif sid == "java-oop":
                    doc = Document(
                        id=f"doc-sample-{sid}",
                        name="Java_OOP_Cheat_Sheet.txt",
                        size="1.1 KB",
                        type="txt",
                        status="Indexed",
                        summary="The four pillars of OOP (Encapsulation, Inheritance, Polymorphism, Abstraction) explained in Java.",
                        ocr_text="Java Object Oriented Programming Pillars:\n\n1. Encapsulation: Keeping fields within a class private, providing public getter and setter methods.\n2. Inheritance: Mechanism where one class acquires the properties of another using extends keyword.\n3. Polymorphism: Ability of an object to take many forms (e.g., method overloading and method overriding).\n4. Abstraction: Hiding implementation details and showing only functional definitions using abstract classes and interfaces.",
                        collection_id=sid
                    )
                    db.add(doc)
                    db.commit()
                    # Index in ChromaDB
                    try:
                        RagEngine.index_document(doc.id, doc.name, [(1, doc.ocr_text)], sid)
                    except Exception as ve:
                        print(f"Error vector indexing java-oop: {ve}")
        db.commit()
    except Exception as e:
        db.rollback()
        print("Failed seeding default subjects:", e)
    finally:
        db.close()
