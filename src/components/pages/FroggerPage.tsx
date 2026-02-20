import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { FroggerGamePanel } from '../arcade/FroggerGamePanel';

export function FroggerPage(props: any) {
  return (
    <PageLayout {...props}>
      <FroggerGamePanel />
    </PageLayout>
  );
}
