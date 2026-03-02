# Carbon Emission Tracker

A modern, high-performance web application designed to track, analyze, and manage personal carbon emissions. Built with a focus on visual excellence and real-time data integration.

## 🚀 Features

- **Real-time Tracking**: Monitor carbon emissions from your activities with an intuitive logging system.
- **Advanced Analytics**: Visualize emission trends and comparisons using interactive charts powered by Chart.js.
- **Garage Management**: Manage your vehicles and track their specific environmental impact.
- **User Profiles**: Comprehensive user dashboard showing trip history, recent activity, and environmental footprint.
- **Supabase Integration**: Secure data storage and authentication powered by Supabase.

## 🛠️ Tech Stack

- **Frontend**: [Vite](https://vitejs.dev/) (Vanilla JS)
- **Database/Auth**: [Supabase](https://supabase.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **Styling**: Vanilla CSS with modern typography (Inter, JetBrains Mono, Space Grotesk)

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/iammuhammedyasir/Carbon-Emission-Tracker.git
   cd Carbon-Emission-Tracker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## 🗃️ Database Schema

The core database logic is managed via Supabase. You can find the initial schema setup in `supabase_schema.sql`.

## 📜 License

This project is private and for educational/personal use.

---

*Built with ❤️ to help track and reduce our carbon footprint.*
