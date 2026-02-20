import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { AsteroidsGamePanel } from '../arcade/AsteroidsGamePanel';

export function AsteroidsPage(props: any) {
  return (
    <PageLayout {...props}>
      <AsteroidsGamePanel />
    </PageLayout>
  );
}
