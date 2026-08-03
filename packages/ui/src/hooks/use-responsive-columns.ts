import { Table } from '@tanstack/react-table';
import { useIsMobile } from '@workspace/ui/hooks/use-mobile';
import { useEffect } from 'react';

export function useResponsiveColumns<TData>(table: Table<TData>) {
  const isMobile = useIsMobile();

  useEffect(() => {
    const columnsToHide = table
      .getAllColumns()
      .map((column) => column.id);

    if (isMobile) {
      // Hide columns on mobile
      columnsToHide.forEach((columnId) => {
        const column = table.getColumn(columnId);
        if (column && column.getIsVisible()) {
          column.toggleVisibility(false);
        }
      });
    } else {
      // Show columns on desktop
      columnsToHide.forEach((columnId) => {
        const column = table.getColumn(columnId);
        if (column && !column.getIsVisible()) {
          column.toggleVisibility(true);
        }
      });
    }
  }, [isMobile, table]);
}
