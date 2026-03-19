import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { Accumul8AccessState } from './accumul8/Accumul8AccessState';
import { Accumul8PageContent } from './accumul8/Accumul8PageContent';
import { useAccumul8PageCompositionSetup } from './accumul8/useAccumul8PageCompositionSetup';
import { useAccumul8PageDataSetup } from './accumul8/useAccumul8PageDataSetup';
import { useAccumul8PageSessionData } from './accumul8/useAccumul8PageSessionData';
import { useAccumul8PageState } from './accumul8/useAccumul8PageState';
import './Accumul8Page.css';

interface Accumul8PageProps extends AppShellPageProps {
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

export function Accumul8Page({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: Accumul8PageProps) {
  const session = useAccumul8PageSessionData(viewer, onToast);
  const state = useAccumul8PageState(session, onToast);
  const data = useAccumul8PageDataSetup(session, state, onToast);
  const composedProps = useAccumul8PageCompositionSetup(session, state, data, viewer, onToast);

  if (!session.isAuthed) {
    return <Accumul8AccessState viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle} mode="login" />;
  }
  if (!session.canAccess) {
    return <Accumul8AccessState viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle} mode="forbidden" />;
  }
  return (
    <Accumul8PageContent
      viewer={viewer}
      onLoginClick={onLoginClick}
      onLogout={onLogout}
      onAccountClick={onAccountClick}
      mysteryTitle={mysteryTitle}
      headerProps={composedProps.headerProps}
      tabContentProps={composedProps.tabContentProps}
      overlayProps={composedProps.overlayProps}
      modalProps={composedProps.modalProps}
      loaded={session.loaded}
    />
  );
}
