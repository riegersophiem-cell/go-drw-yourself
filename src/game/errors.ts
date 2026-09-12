export type GameErrorCode =
  | "NOT_YOUR_TURN"
  | "WRONG_PHASE"
  | "CARD_NOT_IN_HAND"
  | "CARD_NOT_PLAYABLE"
  | "COLOR_REQUIRED"
  | "COLOR_NOT_ALLOWED_NOW"
  | "INVALID_SWAP_TARGET"
  | "INVALID_SKIP_TARGET"
  | "UNKNOWN_PLAYER"
  | "STALE_GAME_STATE"
  | "GAME_ALREADY_OVER";

const MESSAGES: Record<GameErrorCode, string> = {
  NOT_YOUR_TURN: "Du bist noch nicht dran.",
  WRONG_PHASE: "Diese Aktion ist gerade nicht möglich.",
  CARD_NOT_IN_HAND: "Diese Karte hast du nicht auf der Hand.",
  CARD_NOT_PLAYABLE: "Diese Karte kannst du gerade nicht spielen.",
  COLOR_REQUIRED: "Bitte wähle zuerst eine Farbe.",
  COLOR_NOT_ALLOWED_NOW: "Gerade kann keine Farbe gewählt werden.",
  INVALID_SWAP_TARGET: "Dieser Spieler ist kein gültiges Tauschziel.",
  INVALID_SKIP_TARGET: "Dieser Spieler ist kein gültiges Aussetzen-Ziel.",
  UNKNOWN_PLAYER: "Unbekannter Spieler.",
  STALE_GAME_STATE: "Der Spielstand hat sich geändert. Bitte synchronisieren.",
  GAME_ALREADY_OVER: "Das Spiel ist bereits beendet.",
};

export class GameError extends Error {
  code: GameErrorCode;
  constructor(code: GameErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.name = "GameError";
  }
}
