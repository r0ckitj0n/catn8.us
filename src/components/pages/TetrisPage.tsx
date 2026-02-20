import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { TetrisGamePanel } from '../arcade/TetrisGamePanel';

export function TetrisPage(props: any) {
  return (
    <PageLayout {...props}>
      <TetrisGamePanel />
    </PageLayout>
  );
}
