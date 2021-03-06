import { ViewChessBoard } from "./ViewChessBoard.js";
import { ModelChessBoard } from "./ModelChessBoard.js";

export class ControllerChessBoard {
  constructor(publisher, onlineGame) {
    this.view = new ViewChessBoard(
      this.clickChessPiece.bind(this),
      this.clickEmptyCell.bind(this)
    );
    this.model = new ModelChessBoard();

    this.publisher = publisher;
    this.onlineGameModule = onlineGame;

    this.publisher.subscribe("moveBack", this.moveBackToHistory.bind(this));
    this.publisher.subscribe("startPracticeGame", this.newGame.bind(this));
    this.publisher.subscribe("startLoadGame", this.loadGame.bind(this));

    this.publisher.subscribe("createOnlineGame", this.createOnlineGame.bind(this));
    this.publisher.subscribe("joinOnlineGame", this.joinOnlineGame.bind(this));
    this.publisher.subscribe("reconnectOnlineGame", this.reconnectOnlineGame.bind(this));
    this.publisher.subscribe("logout", this.logout.bind(this));
    this.publisher.subscribe("userRemoveGame", this.removeGame.bind(this));

    this.tempPieces = { first: null, second: null };
  }

  newGame() {
    this.publisher.publish("leaveOnlineGame");
    this.model.changeIsOnlineGame = false;
    this.model.notOnlineGame();
    this.view.renderOpMove(false);
    this.view.removeAllPieces(this.model.arrChessPieces);
    let arrNewPiece = this.view.renderNewGame();
    this.model.createNewChessPiece(arrNewPiece, true);
    this.model.whoseMoveNow != "white" ? this.model.changeWhoseMove() : false;
  }

  loadGame() {
    const onlineGame = this.model.getSaveOnlineGame();
    if (onlineGame) return;

    this.view.removeAllPieces(this.model.arrChessPieces);
    const lastMove = this.model.getSaveGame();
    if (lastMove) {
      const arrLoadPiece = this.view.renderSaveGame(lastMove);
      this.model.createNewChessPiece(arrLoadPiece);
      this.publisher.publish("loadGame");
    } else {
      this.view.noLoadGame();
      this.newGame();
    }
  }

  moveBackToHistory(numMove) {
    this.model.changeNumMove = numMove;
    const saveMove = this.model.getSaveGame(numMove);
    const chessPiece = saveMove.tempPieces.first;
    chessPiece.color == this.model.whoseMoveNow
      ? this.model.changeWhoseMove()
      : false;
    this.view.removeAllPieces(this.model.arrChessPieces);
    const newArrChess = this.view.renderSaveGame(saveMove);
    this.model.createNewChessPiece(newArrChess);
    this.view.clearChessBoard(this.model.arrDomNodesChessPiece);

    // check pawn promotion
    const piece = this.model.findChessPieces({
      name: "id",
      value: chessPiece.id
    });
    this.pawnPromotion(piece);
  }

  clickEmptyCell(ev) {
    if (
      ev.target.tagName == "TD" &&
      this.tempPieces.first &&
      this.view.checkCssClass(ev.target, "figure_move")
    ) {
      let previousPos = this.tempPieces.first.pos;
      let chessPiece = this.tempPieces.first;
      this.view.moveToEmptyCell(chessPiece, ev.target);

      // проверка пешки на первый ход и короля с ладьёй
      this.checkPawnFirstMove(chessPiece);
      this.checkKingRookFirstMove(chessPiece);

      // если пешка дошла до конца, то запускаем "обмен пешки"
      this.pawnPromotion(chessPiece);

      // Проверка на чек королю
      this.kingIsCheck(previousPos);

      // взятие на проходе
    } else if (
      ev.target.tagName == "TD" &&
      this.tempPieces.first &&
      this.view.checkCssClass(ev.target, "figure_kill")
    ) {
      let previousPos = {
        x: this.tempPieces.first.pos.x,
        y: this.tempPieces.first.pos.y
      };

      let arg1 = { name: "pieceName", value: "pawn" },
        arg2 = { name: "isFirstMove", value: true };
      this.tempPieces.second = this.model.findChessPieces(arg1, arg2);
      this.view.takingEnemyChessPiece(this.tempPieces, true);

      // Проверка на чек королю
      this.kingIsCheck(previousPos);
    }
  }

  clickChessPiece(ev) {
    let chessPiece = this.model.findChessPieces({
      name: "id",
      value: ev.target.dataset.id
    });

    if (
      this.tempPieces.first &&
      this.model.whoseMoveNow != chessPiece.color &&
      this.view.checkCssClass(chessPiece.div, "figure_kill")
    ) {
      let previousPos = {
        x: this.tempPieces.first.pos.x,
        y: this.tempPieces.first.pos.y
      };
      this.tempPieces.second = chessPiece;
      this.view.takingEnemyChessPiece(this.tempPieces);

      // если пешка дошла до конца, то запускаем "обмен пешки"
      this.pawnPromotion(this.tempPieces.first);

      // проверка пешки на первый ход и короля с ладьёй
      this.checkPawnFirstMove(chessPiece);
      this.checkKingRookFirstMove(this.tempPieces.first);

      // Проверка на чек королю
      this.kingIsCheck(previousPos);

      // выбор ладьи для рокировки
    } else if (
      this.tempPieces.first != chessPiece &&
      this.view.checkCssClass(chessPiece.div, "choosed")
    ) {
      let previousPos = {
        x: this.tempPieces.first.pos.x,
        y: this.tempPieces.first.pos.y
      };
      this.tempPieces.second = chessPiece;
      this.view.renderCastling(this.tempPieces.first, this.tempPieces.second);

      // Проверка на чек королю
      this.kingIsCheck(previousPos);

      // переключение по фигурам одного цвета
    } else if (
      this.model.whoseMoveNow == chessPiece.color &&
      this.tempPieces.first != chessPiece
    ) {
      this.tempPieces.first = chessPiece;
      let moves = this.getMovesPiece(this.tempPieces.first);
      this.view.clearChessBoard(this.model.arrDomNodesChessPiece);
      this.view.selectChessPiece(chessPiece);

      // проверка на рокировку
      this.checkCastling(chessPiece);

      this.view.showMoves(moves);

      // проверка на "взятие на проходе"
      this.enPassant(chessPiece);
    }
  }

  // --------------------------------------------------- Castling -------------------------------------------------
  checkCastling(chessPiece) {
    if (
      chessPiece.pieceName == "king" &&
      !chessPiece.isFirstMove &&
      chessPiece.color == "black" &&
      !this.model.isChecked
    ) {
      const rooks = {
        leftRook: this.model.findChessPieces(
          { name: "id", value: "a8" },
          { name: "isFirstMove", value: null }
        ),
        rightRook: this.model.findChessPieces(
          { name: "id", value: "h8" },
          { name: "isFirstMove", value: null }
        )
      };
      rooks.leftRook || rooks.rightRook
        ? this.choosePiecesForCastling(chessPiece, rooks)
        : false;
    } else if (
      chessPiece.pieceName == "king" &&
      !chessPiece.isFirstMove &&
      chessPiece.color == "white" &&
      !this.model.isChecked
    ) {
      const rooks = {
        leftRook: this.model.findChessPieces(
          { name: "id", value: "a1" },
          { name: "isFirstMove", value: null }
        ),
        rightRook: this.model.findChessPieces(
          { name: "id", value: "h1" },
          { name: "isFirstMove", value: null }
        )
      };
      rooks.leftRook || rooks.rightRook
        ? this.choosePiecesForCastling(chessPiece, rooks)
        : false;
    }
  }

  choosePiecesForCastling(king, { leftRook, rightRook }) {
    if (
      leftRook != null &&
      this.view.checkPieceInCell(king.pos.y, king.pos.x - 1) &&
      this.view.checkPieceInCell(king.pos.y, king.pos.x - 2) &&
      this.view.checkPieceInCell(king.pos.y, king.pos.x - 3)
    ) {
      this.checkCellsForAttack(king, leftRook);
    }

    if (
      rightRook != null &&
      this.view.checkPieceInCell(king.pos.y, king.pos.x + 1) &&
      this.view.checkPieceInCell(king.pos.y, king.pos.x + 2)
    ) {
      this.checkCellsForAttack(king, rightRook);
    }
  }

  checkCellsForAttack(king, rook) {
    // фильтруем все фигуры противника, которые выбиты с доски
    const arrPieces = this.model.arrChessPieces.filter(
      piece =>
        !this.view.checkCssClass(piece.div, "figures_out") &&
        piece.color != king.color
    );

    // смотрим все возможные ходы всех фигур на шахматной доске
    arrPieces.forEach(piece => {
      let moves = this.getMovesPiece(piece);
      this.view.showMoves(moves);
    });
    if (
      rook.pos.x == 8 &&
      !this.view.checkCellUnderAttack(king.pos.y, king.pos.x + 1) &&
      !this.view.checkCellUnderAttack(king.pos.y, king.pos.x + 2)
    ) {
      this.view.addCssClass(rook.div, "choosed");
    } else if (
      rook.pos.x == 1 &&
      !this.view.checkCellUnderAttack(king.pos.y, king.pos.x - 1) &&
      !this.view.checkCellUnderAttack(king.pos.y, king.pos.x - 2)
    ) {
      this.view.addCssClass(rook.div, "choosed");
    }
    this.view.clearChessBoard(this.model.arrDomNodesChessPiece, true);
  }

  checkKingRookFirstMove(chessPiece) {
    if (
      (chessPiece.pieceName == "king" || chessPiece.pieceName == "rook") &&
      chessPiece.isFirstMove == null
    ) {
      chessPiece.isFirstMove = true;
    }
  }

  // --------------------------------------------------- enPassant ------------------------------------------------

  checkPawnFirstMove(chessPiece) {
    if (!this.model.isCheckedNow) {
      const { pieceName, isFirstMove, pos } = chessPiece;

      // если у какой-то пешки прошлый ход был первым, то записываем в isFirstMove = false
      this.model.dropFirstMovePawn();

      // если пешка делает свой первый ход через одну клетку, то записываем ей в isFirstMove = true
      if (
        pieceName == "pawn" &&
        isFirstMove == null &&
        (pos.y == 4 || pos.y == 5)
      ) {
        chessPiece.isFirstMove = true;

        // если пешка делает свой первый ход на одну клетку или было isFirstMove = true, то записываем ее в isFirstMove = false
      } else if (
        pieceName == "pawn" &&
        (isFirstMove == null || isFirstMove == true)
      ) {
        chessPiece.isFirstMove = false;
      }
    }
  }

  enPassant(chessPiece) {
    const { pieceName, color, pos } = chessPiece;
    if (pieceName == "pawn" && color == "white" && pos.y == 4) {
      this.getEnPassantPawn(chessPiece);
    } else if (pieceName == "pawn" && color == "black" && pos.y == 5) {
      this.getEnPassantPawn(chessPiece);
    }
  }

  getEnPassantPawn(chessPiece) {
    const { pieceName, color, pos } = chessPiece;

    const leftPiece = this.model.findChessPiecesByPos(pos.x - 1, pos.y);
    const rightPiece = this.model.findChessPiecesByPos(pos.x + 1, pos.y);
    if (
      leftPiece &&
      leftPiece.pieceName == pieceName &&
      leftPiece.color != color &&
      leftPiece.isFirstMove
    ) {
      this.view.showEnPassantMove(leftPiece);
    } else if (
      rightPiece &&
      rightPiece.pieceName == pieceName &&
      rightPiece.color != color &&
      rightPiece.isFirstMove
    ) {
      this.view.showEnPassantMove(rightPiece);
    }
  }

  // -----------------------------------------------------------------------------------------------------------------

  kingIsCheck(previousPos) {
    // фильтруем фигуры которые выбиты с доски
    const arrPieces = this.model.arrChessPieces.filter(
      piece => !this.view.checkCssClass(piece.div, "figures_out")
    );

    // находим королей и делим их на король пользователя и король противника
    const { userKing, enemyKing } = this.getKingsNow();

    // смотрим все возможные ходы всех фигур на шахматной доске
    arrPieces.forEach(piece => {
      let moves = this.getMovesPiece(piece);
      this.view.showMoves(moves);
    });

    switch (true) {
      //	Если до этого не было шаха и после хода король противника попал под шах и НЕ попал под шах король пользователя
      case !this.model.isCheckedNow &&
        this.view.checkCssClass(enemyKing.div, "figure_kill") &&
        !this.view.checkCssClass(userKing.div, "figure_kill"):
        this.view.kingIsBlinking(enemyKing);
        this.model.changeIsChecked = true;
        this.endMove(previousPos);
        break;
      //	Если до этого не было шаха и после хода король пользователя попал под шах, отменяем ход
      case !this.model.isCheckedNow &&
        this.view.checkCssClass(userKing.div, "figure_kill"):
        this.moveBack(userKing);
        break;
      //	Если был шах и после хода король пользователя остался под шахом, отменяем ход
      case this.model.isCheckedNow &&
        this.view.checkCssClass(userKing.div, "figure_kill"):
        this.moveBack(userKing);
        break;
      //	Если был шах и после хода шах пропал
      case this.model.isCheckedNow &&
        !this.view.checkCssClass(userKing.div, "figure_kill"):
        this.model.changeIsChecked = false;
        this.endMove(previousPos);
        break;

      default:
        this.endMove(previousPos);
        break;
    }
    this.view.clearChessBoard(this.model.arrDomNodesChessPiece);
  }

  moveBack(userKing) {
    this.view.kingIsBlinking(userKing);

    // если в истории ходов выбран ход когда шах королю, то мы возвращаемся к ходу который выбран (если текущий ход не убрал шах),
    // если нет - тогда берем последний ход с истории
    let saveGame =
      this.model.getNumMove == null
        ? this.model.getSaveGame()
        : this.model.getSaveGame(this.model.getNumMove);
    this.view.cancelMove(saveGame.arrChessPieces, this.model.arrChessPieces);
    this.tempPieces = { first: null, second: null };
  }

  getKingsNow() {
    let userColor = this.model.whoseMoveNow == "white" ? "white" : "black",
      enemyColor = this.model.whoseMoveNow == "white" ? "black" : "white";
    const kings = {
      userKing: this.model.findChessPieces(
        { name: "color", value: userColor },
        { name: "pieceName", value: "king" }
      ),
      enemyKing: this.model.findChessPieces(
        { name: "color", value: enemyColor },
        { name: "pieceName", value: "king" }
      )
    };
    return kings;
  }

  endMove(previousPos) {
    // сохраняем позиции всех фигур после хода и последний ход
    this.model.saveGameToLocalStorage(this.tempPieces, previousPos);

    // очищаем доску от возможных ходов, а так же обнуляем временные фигуры
    this.view.clearChessBoard(this.model.arrDomNodesChessPiece);
    this.tempPieces = { first: null, second: null };

    // передаем ход другому игроку
    if (this.model.isOnlineGame) {
      this.endMoveOnline();
    } else {
      this.model.changeWhoseMove();
    }

    // обнуляем выбраного хода в истории
    this.model.changeNumMove = null;

    // Оповещаем что ход сделан
    this.publisher.publish("moveEnd");
  }

  pawnPromotion(chessPiece) {
    if (
      !this.model.isCheckedNow &&
      chessPiece.pieceName == "pawn" &&
      (chessPiece.pos.y == 1 || chessPiece.pos.y == 8)
    ) {
      this.view.renderPawnPromotion(chessPiece).then(pieceName => {
        this.model.savePawnPromotion(chessPiece, pieceName);
        this.model.saveGameToLocalStorage(
          { first: chessPiece, second: null },
          chessPiece.pos
        );

        // передаем ход другому игроку
        if (this.model.isOnlineGame) {
          this.endMoveOnline();
        }

        // Оповещаем что ход сделан
        this.publisher.publish("moveEnd");
      });
    }
  }

  // Online game block
  createOnlineGame(gameId) {
    this.model.saveGameId(gameId);
    const handlers = {
      startGame: this.startOnlineGame.bind(this),
      startMove: this.startMoveOnline.bind(this),
      opLeaveGame: this.opLeaveGame.bind(this)
    };
    this.onlineGameModule.createGame(gameId, handlers);
  }

  joinOnlineGame(gameId) {
    const handlers = {
      startGame: this.startOnlineGame.bind(this),
      startMove: this.startMoveOnline.bind(this),
      opLeaveGame: this.opLeaveGame.bind(this)
    };
    const login = this.model.getUserLogin();
    this.onlineGameModule.joinGame(gameId, login, handlers);
  }

  newOnlineGame() {
    this.model.changeIsOnlineGame = true;
    this.view.removeAllPieces(this.model.arrChessPieces);
    let arrNewPiece = this.view.renderNewGame();
    this.model.createNewChessPiece(arrNewPiece, true);
    this.model.whoseMoveNow != "white" ? this.model.changeWhoseMove() : false;
  }

  startOnlineGame({ opponent, gameId }) {
    this.model.saveGameId(gameId);
    this.model.saveOpponent(opponent);

    this.newOnlineGame();
    if (opponent.color === "white") {
      this.model.changeWhoseMove();
      this.view.removeAllListeners(this.model.arrChessPieces);
      this.view.renderOpMove(true);
    }
  }

  endMoveOnline() {
    const saveGame = this.model.getSaveGame();
    const id = this.model.getGameId();
    this.onlineGameModule.sendMove(id, saveGame);
    this.view.removeAllListeners(this.model.arrChessPieces);
    this.view.renderOpMove(true);
  }

  startMoveOnline(game) {
    this.model.changeSaveGame(game);
    this.view.removeAllPieces(this.model.arrChessPieces);
    const arrLoadPiece = this.view.renderSaveGame(game);
    this.model.createNewChessPiece(arrLoadPiece);
    this.publisher.publish("loadGame");
    this.view.renderOpMove(false);
  }

  reconnectOnlineGame() {
    const login = this.model.getUserLogin();
    const onlineGame = this.model.getSaveOnlineGame();
    const handlers = {
      startGame: this.startOnlineGame.bind(this),
      startMove: this.startMoveOnline.bind(this),
      opLeaveGame: this.opLeaveGame.bind(this)
    };
    this.onlineGameModule.reconnect(onlineGame.gameId, login, handlers);

    const saveGame = this.model.getSaveGame();
    if (saveGame) {
      this.model.changeIsOnlineGame = true;
      this.view.removeAllPieces(this.model.arrChessPieces);
      const arrLoadPiece = this.view.renderSaveGame(saveGame);
      this.model.createNewChessPiece(arrLoadPiece);
      this.publisher.publish("loadGame");


      const prevColorMove = saveGame.tempPieces.first.color;
      if (onlineGame.opColor !== prevColorMove) {
        this.view.removeAllListeners(this.model.arrChessPieces);
        this.view.renderOpMove(true);
      }
      this.model.whoseMoveNow === onlineGame.opColor ? this.model.changeWhoseMove() : false;
    }
  }

  opLeaveGame() {
    this.view.renderOpLeave(this.handlerModalOpLeave.bind(this));
    this.view.removeAllListeners(this.model.arrChessPieces);
  }

  handlerModalOpLeave() {
    this.view.closeModalOpLeave();
    this.model.changeIsOnlineGame = false;
    this.model.notOnlineGame();
    this.view.renderOpMove(false);
    this.view.clearChessBoard(this.model.arrDomNodesChessPiece);
    this.view.removeAllPieces(this.model.arrChessPieces);
    this.model.createNewChessPiece([], true);
    this.publisher.publish("clearHistory");
  }

  removeGame() {
    this.view.clearChessBoard(this.model.arrDomNodesChessPiece);
    this.view.removeAllPieces(this.model.arrChessPieces);
    this.model.createNewChessPiece([], true);
    this.publisher.publish("clearHistory");
    this.model.notOnlineGame();
    this.view.renderOpMove(false);
  }

  // End Online game block

  logout() {
    const onlineGame = this.model.getSaveOnlineGame();
    if (onlineGame) {
      this.publisher.publish("leaveOnlineGame");
      this.model.changeIsOnlineGame = false;
      this.model.notOnlineGame();
      this.view.renderOpMove(false);
      this.view.clearChessBoard(this.model.arrDomNodesChessPiece);
      this.view.removeAllPieces(this.model.arrChessPieces);
      this.model.createNewChessPiece([], true);
      this.publisher.publish("clearHistory");
    };

  }

  getMovesPiece({ pieceName, pos, color }) {
    switch (pieceName) {
      case "king": {
        // -------------------------------- King ----------------------------------
        let arrMovesKing = [];

        if (pos.y > 1 && pos.y < 8 && pos.x > 1 && pos.x < 8) {
          for (let i = pos.y - 1; i < pos.y + 2; i++) {
            for (let j = pos.x - 1; j < pos.x + 2; j++) {
              arrMovesKing.push({ y: i, x: j });
            }
          }
        } else if (pos.y == 8 && pos.x > 1 && pos.x < 8) {
          for (let i = pos.y - 1; i < pos.y + 1; i++) {
            for (let j = pos.x - 1; j < pos.x + 2; j++) {
              arrMovesKing.push({ y: i, x: j });
            }
          }
        } else if (pos.y == 1 && pos.x > 1 && pos.x < 8) {
          for (let i = pos.y; i < pos.y + 2; i++) {
            for (let j = pos.x - 1; j < pos.x + 2; j++) {
              arrMovesKing.push({ y: i, x: j });
            }
          }
        } else if (pos.y > 1 && pos.y < 8 && pos.x == 8) {
          for (let i = pos.y - 1; i < pos.y + 2; i++) {
            for (let j = pos.x - 1; j < pos.x + 1; j++) {
              arrMovesKing.push({ y: i, x: j });
            }
          }
        } else if (pos.y > 1 && pos.y < 8 && pos.x == 1) {
          for (let i = pos.y - 1; i < pos.y + 2; i++) {
            for (let j = pos.x; j < pos.x + 2; j++) {
              arrMovesKing.push({ y: i, x: j });
            }
          }
        } else if (pos.y == 1 && pos.x == 1) {
          arrMovesKing.push({ y: 1, x: 2 }, { y: 2, x: 2 }, { y: 2, x: 1 });
        } else if (pos.y == 1 && pos.x == 8) {
          arrMovesKing.push({ y: 1, x: 7 }, { y: 2, x: 7 }, { y: 2, x: 8 });
        } else if (pos.y == 8 && pos.x == 8) {
          arrMovesKing.push({ y: 8, x: 7 }, { y: 7, x: 7 }, { y: 7, x: 8 });
        } else if (pos.y == 8 && pos.x == 1) {
          arrMovesKing.push({ y: 7, x: 1 }, { y: 7, x: 2 }, { y: 8, x: 2 });
        }
        return { color, arrMoveCells: arrMovesKing };
      }
      case "queen": {
        // -------------------------------- Queen ----------------------------------
        let arrMovesQueen = [],
          diffNum = null;

        // up-left move
        diffNum = pos.x - pos.y;
        end1: for (let i = pos.y - 1; i > 0; i--) {
          for (let j = pos.x - 1; j > 0; j--) {
            if (j - i == diffNum) {
              if (this.view.checkPieceInCell(i, j))
                arrMovesQueen.push({ y: i, x: j });
              else {
                arrMovesQueen.push({ y: i, x: j });
                break end1;
              }
            }
          }
        }

        // down-left move
        diffNum = pos.x + pos.y;
        end2: for (let i = pos.y + 1; i < 9; i++) {
          for (let j = pos.x - 1; j > 0; j--) {
            if (j + i == diffNum) {
              if (this.view.checkPieceInCell(i, j))
                arrMovesQueen.push({ y: i, x: j });
              else {
                arrMovesQueen.push({ y: i, x: j });
                break end2;
              }
            }
          }
        }

        // up-right move
        diffNum = pos.x + pos.y;
        end3: for (let i = pos.y - 1; i > 0; i--) {
          for (let j = pos.x + 1; j < 9; j++) {
            if (j + i == diffNum) {
              if (this.view.checkPieceInCell(i, j))
                arrMovesQueen.push({ y: i, x: j });
              else {
                arrMovesQueen.push({ y: i, x: j });
                break end3;
              }
            }
          }
        }

        // down-right move
        diffNum = pos.x - pos.y;
        end4: for (let i = pos.y + 1; i < 9; i++) {
          for (let j = pos.x + 1; j < 9; j++) {
            if (j - i == diffNum) {
              if (this.view.checkPieceInCell(i, j))
                arrMovesQueen.push({ y: i, x: j });
              else {
                arrMovesQueen.push({ y: i, x: j });
                break end4;
              }
            }
          }
        }

        // up move
        for (let i = pos.y - 1; i > 0; i--) {
          if (this.view.checkPieceInCell(i, pos.x))
            arrMovesQueen.push({ y: i, x: pos.x });
          else {
            arrMovesQueen.push({ y: i, x: pos.x });
            break;
          }
        }

        // down move
        for (let i = pos.y + 1; i < 9; i++) {
          if (this.view.checkPieceInCell(i, pos.x))
            arrMovesQueen.push({ y: i, x: pos.x });
          else {
            arrMovesQueen.push({ y: i, x: pos.x });
            break;
          }
        }

        // right move
        for (let i = pos.x + 1; i < 9; i++) {
          if (this.view.checkPieceInCell(pos.y, i))
            arrMovesQueen.push({ y: pos.y, x: i });
          else {
            arrMovesQueen.push({ y: pos.y, x: i });
            break;
          }
        }

        // left move
        for (let i = pos.x - 1; i > 0; i--) {
          if (this.view.checkPieceInCell(pos.y, i))
            arrMovesQueen.push({ y: pos.y, x: i });
          else {
            arrMovesQueen.push({ y: pos.y, x: i });
            break;
          }
        }
        return { color, arrMoveCells: arrMovesQueen };
      }
      case "rook": {
        // -------------------------------- Rook ----------------------------------
        let arrMovesRook = [];

        // up move
        for (let i = pos.y - 1; i > 0; i--) {
          if (this.view.checkPieceInCell(i, pos.x))
            arrMovesRook.push({ y: i, x: pos.x });
          else {
            arrMovesRook.push({ y: i, x: pos.x });
            break;
          }
        }

        // down move
        for (let i = pos.y + 1; i < 9; i++) {
          if (this.view.checkPieceInCell(i, pos.x))
            arrMovesRook.push({ y: i, x: pos.x });
          else {
            arrMovesRook.push({ y: i, x: pos.x });
            break;
          }
        }

        // right move
        for (let i = pos.x + 1; i < 9; i++) {
          if (this.view.checkPieceInCell(pos.y, i))
            arrMovesRook.push({ y: pos.y, x: i });
          else {
            arrMovesRook.push({ y: pos.y, x: i });
            break;
          }
        }

        // left move
        for (let i = pos.x - 1; i > 0; i--) {
          if (this.view.checkPieceInCell(pos.y, i))
            arrMovesRook.push({ y: pos.y, x: i });
          else {
            arrMovesRook.push({ y: pos.y, x: i });
            break;
          }
        }

        return { color, arrMoveCells: arrMovesRook };
      }
      case "bishop": {
        // -------------------------------- Bishop ----------------------------------
        let arrMovesBishop = [],
          diffNum1 = null;
        // up-left move
        diffNum1 = pos.x - pos.y;
        end1: for (let i = pos.y - 1; i > 0; i--) {
          for (let j = pos.x - 1; j > 0; j--) {
            if (j - i == diffNum1) {
              if (this.view.checkPieceInCell(i, j))
                arrMovesBishop.push({ y: i, x: j });
              else {
                arrMovesBishop.push({ y: i, x: j });
                break end1;
              }
            }
          }
        }

        // down-left move
        diffNum1 = pos.x + pos.y;
        end2: for (let i = pos.y + 1; i < 9; i++) {
          for (let j = pos.x - 1; j > 0; j--) {
            if (j + i == diffNum1) {
              if (this.view.checkPieceInCell(i, j))
                arrMovesBishop.push({ y: i, x: j });
              else {
                arrMovesBishop.push({ y: i, x: j });
                break end2;
              }
            }
          }
        }

        // up-right move
        diffNum1 = pos.x + pos.y;
        end3: for (let i = pos.y - 1; i > 0; i--) {
          for (let j = pos.x + 1; j < 9; j++) {
            if (j + i == diffNum1) {
              if (this.view.checkPieceInCell(i, j))
                arrMovesBishop.push({ y: i, x: j });
              else {
                arrMovesBishop.push({ y: i, x: j });
                break end3;
              }
            }
          }
        }

        // down-right move
        diffNum1 = pos.x - pos.y;
        end4: for (let i = pos.y + 1; i < 9; i++) {
          for (let j = pos.x + 1; j < 9; j++) {
            if (j - i == diffNum1) {
              if (this.view.checkPieceInCell(i, j))
                arrMovesBishop.push({ y: i, x: j });
              else {
                arrMovesBishop.push({ y: i, x: j });
                break end4;
              }
            }
          }
        }

        return { color, arrMoveCells: arrMovesBishop };
      }
      case "knight": {
        // -------------------------------- Knight ----------------------------------
        let arrMovesKnight = [];

        // up move
        if (pos.y > 2 && pos.x != 8 && pos.x != 1)
          arrMovesKnight.push(
            { y: pos.y - 2, x: pos.x - 1 },
            { y: pos.y - 2, x: pos.x + 1 }
          );
        else if (pos.y > 2 && pos.x == 8)
          arrMovesKnight.push({ y: pos.y - 2, x: pos.x - 1 });
        else if (pos.y > 2 && pos.x == 1)
          arrMovesKnight.push({ y: pos.y - 2, x: pos.x + 1 });

        // down move
        if (pos.y < 7 && pos.x != 8 && pos.x != 1)
          arrMovesKnight.push(
            { y: pos.y + 2, x: pos.x - 1 },
            { y: pos.y + 2, x: pos.x + 1 }
          );
        else if (pos.y < 7 && pos.x == 8)
          arrMovesKnight.push({ y: pos.y + 2, x: pos.x - 1 });
        else if (pos.y < 7 && pos.x == 1)
          arrMovesKnight.push({ y: pos.y + 2, x: pos.x + 1 });

        // left move
        if (pos.x > 2 && pos.y != 8 && pos.y != 1)
          arrMovesKnight.push(
            { y: pos.y - 1, x: pos.x - 2 },
            { y: pos.y + 1, x: pos.x - 2 }
          );
        else if (pos.x > 2 && pos.y == 8)
          arrMovesKnight.push({ y: pos.y - 1, x: pos.x - 2 });
        else if (pos.x > 2 && pos.y == 1)
          arrMovesKnight.push({ y: pos.y + 1, x: pos.x - 2 });

        // right move
        if (pos.x < 7 && pos.y != 8 && pos.y != 1)
          arrMovesKnight.push(
            { y: pos.y - 1, x: pos.x + 2 },
            { y: pos.y + 1, x: pos.x + 2 }
          );
        else if (pos.x < 7 && pos.y == 8)
          arrMovesKnight.push({ y: pos.y - 1, x: pos.x + 2 });
        else if (pos.x < 7 && pos.y == 1)
          arrMovesKnight.push({ y: pos.y + 1, x: pos.x + 2 });
        return { color, arrMoveCells: arrMovesKnight };
      }
      case "pawn": {
        // -------------------------------- Pawn ----------------------------------
        let arrMovesPawn = [],
          arrKillCells = [];
        //
        if (color == "white") {
          //
          if (pos.y == 7 && this.view.checkPieceInCell(6, pos.x))
            arrMovesPawn.push(
              { y: pos.y - 1, x: pos.x },
              { y: pos.y - 2, x: pos.x }
            );
          else if (pos.y > 1) arrMovesPawn.push({ y: pos.y - 1, x: pos.x });
          //
          if (pos.x == 1) arrKillCells.push({ y: pos.y - 1, x: pos.x + 1 });
          else if (pos.x == 8)
            arrKillCells.push({ y: pos.y - 1, x: pos.x - 1 });
          else
            arrKillCells.push(
              { y: pos.y - 1, x: pos.x - 1 },
              { y: pos.y - 1, x: pos.x + 1 }
            );
          //
        } else if (color == "black") {
          //
          if (pos.y == 2 && this.view.checkPieceInCell(3, pos.x))
            arrMovesPawn.push(
              { y: pos.y + 1, x: pos.x },
              { y: pos.y + 2, x: pos.x }
            );
          else if (pos.y < 8) arrMovesPawn.push({ y: pos.y + 1, x: pos.x });
          //
          if (pos.x == 1) arrKillCells.push({ y: pos.y + 1, x: pos.x + 1 });
          else if (pos.x == 8)
            arrKillCells.push({ y: pos.y + 1, x: pos.x - 1 });
          else
            arrKillCells.push(
              { y: pos.y + 1, x: pos.x - 1 },
              { y: pos.y + 1, x: pos.x + 1 }
            );
        }
        return { color, arrMoveCells: arrMovesPawn, arrKillCells };
      }
    }
  }
}
