import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { PaginationState } from '../agent/pagination';

interface PaginatedListProps<T> {
  state: PaginationState<T>;
  renderItem: (item: T, idx: number) => React.ReactNode;
  onNext: () => void;
  onPrev: () => void;
  onQuit?: () => void;
}

export function PaginatedList<T>({ state, renderItem, onNext, onPrev, onQuit }: PaginatedListProps<T>) {
  if (!state || !Array.isArray(state.items)) {
    return <Text color="red">[PaginatedList] Invalid state or items</Text>;
  }
  useInput((input) => {
    // eslint-disable-next-line no-console
    console.log('[PaginatedList] useInput received:', input, {
      hasNext: state.hasNext, hasPrev: state.hasPrev, page: state.page, items: state.items.length
    });
    if (input === 'n' && state.hasNext) onNext();
    if (input === 'p' && state.hasPrev) onPrev();
    if ((input === 'q' || input === 'x') && onQuit) onQuit(); // support 'x' for test quit
  });
  return (
    <Box flexDirection="column">
      {state.items.length > 0 ? state.items.map(renderItem) : null}
      <Text>
        Page {state.page + 1}
        {state.hasPrev && ' [p] Prev'}
        {state.hasNext && ' [n] Next'}
        {' [q] Quit'}
      </Text>
    </Box>
  );
}
