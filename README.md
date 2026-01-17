# RealToken Offer Viewer

Mini-project to view and purchase RealToken YAM offers by ID.

## 🚀 Quick start

### Prerequisites

- Node.js >= 20.18.0
- yarn >= 1.22.22

### Installation

1. **Clone the project**

2. **Install dependencies**

```bash
yarn install
```

3. **Configure the environment variables**

Create a `.env` file at the root of the project

4. **Start the development server**

```bash
yarn dev
```

5. **Open in the browser**

```
http://localhost:3000/?id=YOUR_OFFER_ID
```

## 📁 Project structure

```
realtoken-offer-viewer/
├── pages/
│   └── index.tsx     # Main page
├── styles/
│   └── globals.css        # Global styles
├── public/                # Static assets
├── .env.example           # Environment variables template
├── next.config.js         # Next.js configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
├── package.json           # Dependencies
└── README.md             # This file
```

## 🌐 Usage

### Search an offer

1. Enter an offer ID in the search bar
2. Click on "Search" or press Enter
3. The offer details are displayed

### Buy an offer

1. Click on "Buy this offer"
2. Enter the desired quantity
3. Confirm the transaction

## 🔐 Sécurité

⚠️ **Important** : 
- Never commit the `.env` file
- The `COMMUNITY_API_KEY` must never be exposed to the client
- Only variables with `NEXT_PUBLIC_` are accessible to the client

## 🚀 Deployment

### Docker

```bash
# Build
docker build -t realtoken-offer-viewer .

# Run
docker run -p 3000:3000 realtoken-offer-viewer
```