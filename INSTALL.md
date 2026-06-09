# Local Installation Guide

Follow these steps to set up the **AI Project Interview Generator** on your local machine.

---

## 🛠️ Prerequisites

* **Python**: Version 3.10 or higher.
* **Node.js**: Version 18.0 or higher, with NPM.
* **API Key**: A Google Gemini API Key (obtainable from Google AI Studio).

---

## 1. Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create a virtual environment**:
   * On Windows:
     ```powershell
     python -m venv venv
     ```
   * On macOS/Linux:
     ```bash
     python3 -m venv venv
     ```

3. **Activate the virtual environment**:
   * On Windows:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. **Install backend dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure environment settings**:
   Create a `.env` file in the root of the `backend/` directory:
   ```env
   DATABASE_URL=sqlite:///./interview_generator.db
   SECRET_KEY=replace_this_with_a_secure_random_key_for_production
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-1.5-flash
   ```
   *Note: If no `GEMINI_API_KEY` is provided, the application will automatically run in Mock Fallback Mode. All features will be functional using mock responses, allowing easy layout and flow testing.*

6. **Launch the FastAPI server**:
   ```bash
   python run.py
   ```
   The API documentation will be available at `http://127.0.0.1:8000/docs`.

---

## 2. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd ../frontend
   ```

2. **Install Node modules**:
   ```bash
   npm install
   ```

3. **Launch the Vite development server**:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

---

## 3. Verify the Installation

1. Open `http://localhost:5173` in your browser.
2. Click **Get Started** and fill out the Registration form.
3. Once redirected to the Dashboard, click **Analyze a Project** or **Upload Project**.
4. Upload a small ZIP file (containing code files) or enter a public GitHub link (e.g. `https://github.com/octocat/Spoon-Knife`).
5. Wait for the analysis pipeline to compile. You should see a list of technologies and diagrams appear on your dashboard.
