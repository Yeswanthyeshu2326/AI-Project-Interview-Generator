# API Documentation Reference

All API request and response data must be formatted in JSON. Protected endpoints require a valid JWT bearer token in the `Authorization` header.

---

## 🔑 Authentication Endpoints

### 1. Register User
* **URL**: `/api/auth/register`
* **Method**: `POST`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "password": "strong_password_123"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "user-uuid",
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "created_at": "2026-06-09T20:45:00"
    }
  }
  ```

### 2. Login User
* **URL**: `/api/auth/login`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "email": "jane.doe@example.com",
    "password": "strong_password_123"
  }
  ```
* **Response (200 OK)**:
  Same structure as the registration token payload.

### 3. Get Profile
* **URL**: `/api/auth/profile`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
  ```json
  {
    "id": "user-uuid",
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "created_at": "2026-06-09T20:45:00"
  }
  ```

---

## 📁 Project Management Endpoints

### 1. Upload Project (ZIP)
* **URL**: `/api/projects/upload-zip`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**: Multipart form data containing:
  - `name`: String (Project name)
  - `file`: Binary file (.zip archive)
* **Response (200 OK)**: Project metadata object.

### 2. Import from GitHub
* **URL**: `/api/projects/import-github`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**: Form parameters:
  - `name`: String (Project name)
  - `repo_url`: String (GitHub repository URL)
* **Response (200 OK)**: Project metadata object.

### 3. List User Projects
* **URL**: `/api/projects/`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**: Array of project metadata.

### 4. Fetch Analysis Summaries
* **URL**: `/api/projects/{project_id}/analysis`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**: Summaries, explainers, and Mermaid diagram code structures.

---

## 📝 Interview Preparation Endpoints

### 1. Get Questions list
* **URL**: `/api/interviews/{project_id}/questions`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Query Parameters**:
  - `difficulty`: Optional String (`beginner`, `intermediate`, `advanced`)
* **Response (200 OK)**: Array of question items containing ideal answers, expects, mistakes, and practices.

### 2. Download Questions (PDF)
* **URL**: `/api/interviews/{project_id}/download-pdf`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**: Binary file stream (`application/pdf`) containing the formatted guide.

---

## 💬 Mock Interview Endpoints

### 1. Start Session
* **URL**: `/api/mock/session`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "project_id": "project-uuid"
  }
  ```
* **Response (200 OK)**:
  Session metadata containing the initial interviewer welcome question.

### 2. Submit Chat message
* **URL**: `/api/mock/session/{session_id}/message`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**:
  ```json
  {
    "message": "My response to the interviewer's question."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "evaluation": {
      "score": 85,
      "technical_accuracy": "Feedback...",
      "communication": "Feedback...",
      "completeness": "Feedback...",
      "confidence": "Feedback..."
    },
    "interviewer_response": "Next question...",
    "interviewer_msg_id": "message-uuid"
  }
  ```

### 3. Complete Session
* **URL**: `/api/mock/session/{session_id}/complete`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**: Finalized session scorecard detailing aggregate ratings.

---

## 📄 Resume Building Endpoints

### 1. Get Resume bullet details
* **URL**: `/api/resume/{project_id}`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**: Resume parameters containing achievements, matches, and optimized descriptions.

### 2. Export Resume Entry (TXT)
* **URL**: `/api/resume/{project_id}/download-txt`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**: Text file stream containing the plain text layout.
