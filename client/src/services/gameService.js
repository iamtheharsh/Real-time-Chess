import api from "./api";

export const createGame = (timeControl) => api.post("/games/create", { timeControl });

export const joinGame = (gameId) => api.post("/games/join", { gameId });

export const getGame = (gameId) => api.get(`/games/${gameId}`);

export const getHistory = () => api.get("/games/history");
