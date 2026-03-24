# ShopBop Showdown

University of Wisconsin–Madison  
Computer Science Capstone – Spring 2026  
Amazon / ShopBop Partnership

ShopBop Showdown is a multiplayer fashion styling game that turns outfit creation into a competitive and social experience. Players build outfits using curated fashion products and compete to create the best look based on a theme, budget, and time limit.

The project explores how fashion discovery can be transformed from a solo browsing experience into a fast-paced multiplayer game with real-time voting and AI-generated outfit previews.

---

## Project Overview

Online fashion platforms contain thousands of products, making it difficult for users to quickly assemble outfits or stay on top of trends.

ShopBop Showdown addresses this by introducing a competitive styling game where players:

1. Join a multiplayer lobby
2. Build outfits using fashion products
3. Compete within constraints such as theme, budget, and time
4. Vote on the best outfit
5. Reveal results and rankings

The platform combines fashion discovery, social competition, and real-time interaction.

---

## Features

### Multiplayer Lobby
Players can create or join a game room and synchronize with other players in real time.

### Outfit Builder
Players build outfits while balancing three constraints:
- Theme
- Budget
- Timer

### AI Virtual Try-On
The system generates visual outfit previews so players can see how selected items work together before submission.

Pipeline:
Products → Backend → AI Generation → Outfit Preview

### Real-Time Gameplay
Game state is synchronized using WebSockets so all players see the same lobby state, styling phase, voting phase, and results.

### Blind Voting
Players evaluate outfits before creator identities are revealed to ensure fair judging.

### Results & Rankings
Votes are aggregated and final rankings determine the winning outfit.

---

## Tech Stack

Frontend  
React  
Vite

State Management  
Zustand

Backend  
Node.js  
Express

Real-Time Communication  
Socket.IO

APIs  
ShopBop product API proxy  
AI outfit preview generation

---

## System Architecture

Players (Browser)  
↓  
React Frontend (Vite)  
↓  
REST API + WebSockets  
↓  
Node.js / Express Backend  
↓  
AI Outfit Generation

The backend handles game state, voting logic, real-time synchronization, and AI image generation requests.

---

## Project Structure

ShopBop-Showdown

frontend  
- src  
  - components  
  - pages  
  - services  
  - store  

backend  
- routes  
- middleware  
- db  
- server.js  

scripts  

---

## Local Development

### Clone the repository

git clone https://github.com/YOUR-REPO/shopbop-showdown.git  
cd shopbop-showdown

### Install dependencies

Frontend

cd frontend  
npm install

Backend

cd ../backend  
npm install

### Run the development servers

Backend

npm run dev

Frontend

npm run dev

The application will then be available locally in your browser.

---

## Demo Flow

1. Create a game
2. Players join the lobby
3. Players build outfits
4. Players vote
5. Results reveal the winning outfit

---

## Team

Leo Jeong — Scrum Master  
Siddhanth Pandey — Product Owner  
Anirudh Kompella — Scribe  
Ishita Kapoor — Demo Coordinator  
Kinhkha Tran — Testing Lead  
Buman-Erdem Enkhbold — UX Design

---

## License

Developed as part of the University of Wisconsin–Madison Computer Science Capstone (Spring 2026) in collaboration with Amazon / ShopBop.