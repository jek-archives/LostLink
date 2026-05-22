# 🔍 LostLink Web App

LostLink is a centralized, gamified web portal built for campus communities to help students report, track, and reclaim lost belongings. By incorporating real-time updates and gamified reward systems, it turns reuniting items with their owners into a collaborative, campus-driven effort.

---

## 🌟 Key Features

* **Real-time Item Feed:** Report and view lost and found items instantly (synced with Supabase Database).
* **Gamified XP System:** Earn XP by engaging with the community:
  * **Post a Report:** +5 XP
  * **Successfully Return/Resolve an Item:** +50 XP
  * **Level Progression:** Accumulate XP to rank up and display your helper status.
* **Campus Classification:** Filter items by categories (electronics, keys, wallets, clothing, books) and specific campus zones.
* **Interactive Claims:** Claims automatically notify the item's reporter via Resend API email triggers.
* **Cloud-backed Image Uploads:** Attach photos of lost/found items directly to reports (powered by Cloudinary).
* **Demo Sandbox Mode:** Built-in offline testing sandbox utilizing `localStorage` to completely simulate backend flows without needing Supabase redirect configuration.

---

## 🛠️ Technology Stack

* **Frontend:** React 19, Vite, TypeScript, TailwindCSS v4, Framer Motion, Lucide Icons
* **Backend:** Express.js, TypeScript (run via `tsx`)
* **Database & Auth:** Supabase (PostgreSQL, Supabase Auth)
* **Third-Party APIs:**
  * **Cloudinary:** Image hosting
  * **Resend:** Email notification system
  * **Google Gemini API:** AI-driven assistive utilities
  * **Google Maps Platform:** Location visualization

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18 or higher recommended)
* A Supabase project and account

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jek-archives/LostLink.git
   cd LostLink
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and populate it with the following configuration:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # API Keys
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_MAPS_PLATFORM_KEY=your_google_maps_key
   RESEND_API_KEY=your_resend_api_key

   # Cloudinary Credentials
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. **Database Schema Setup:**
   Run the SQL migration script located in `./supabase/migrations/20260523000000_init.sql` inside your Supabase Project SQL Editor to initialize the tables, Row Level Security (RLS) policies, and auth-sync triggers.

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be running locally at `http://localhost:3000/`.

---

## 🧪 Testing with Sandbox Mode

If you are developing locally and haven't configured the authorized redirect domains inside your Supabase Console, you can bypass auth using **Try Demo Sandbox Mode**:
* **Instant Login:** Click the sandbox button on the landing page to sign in immediately as `Demo Student`.
* **Isolated Environment:** Actions like reporting new items and resolving claims will write to `localStorage` instead of Supabase, preventing permission or network errors.
