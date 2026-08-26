import api from "./api";

export const createGame = () => api.post("/games/create");

export const joinGame = (gameId) => api.post("/games/join", { gameId });

export const getGame = (gameId) => api.get(`/games/${gameId}`);

export const getHistory = () => api.get("/games/history");
