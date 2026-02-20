import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { ArcadeGameId } from '../../types/arcade';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { AsteroidsGamePanel } from '../arcade/AsteroidsGamePanel';
import { FroggerGamePanel } from '../arcade/FroggerGamePanel';
import { TetrisGamePanel } from '../arcade/TetrisGamePanel';

interface ArcadeGameModalProps {
  open: boolean;
  gameId: ArcadeGameId | null;
  onClose: () => void;
}

const GAME_TITLE: Record<ArcadeGameId, string> = {
  tetris: 'Tetris',
  frogger: 'Frogger',
  asteroids: 'Asteroids',
};

export function ArcadeGameModal({ open, gameId, onClose }: ArcadeGameModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open && gameId) modal.show();
    else modal.hide();
  }, [open, gameId, modalApiRef]);

  const title = gameId ? GAME_TITLE[gameId] : 'Arcade Game';

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body p-0">
            {gameId === 'tetris' ? <TetrisGamePanel /> : null}
            {gameId === 'frogger' ? <FroggerGamePanel /> : null}
            {gameId === 'asteroids' ? <AsteroidsGamePanel /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
