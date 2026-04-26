import React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * Layout route for /add-cards — pure pass-through.
 *
 * The actual gallery lives in `add-cards.index.tsx`, and the three add
 * methods (`manual`, `csv`, `fabrary`) live in their own sibling files
 * registered as children. Without this layout the parent would render
 * its own component AND the child via Outlet, stacking them — by making
 * the parent render only `<Outlet />` we let each subview own the full
 * page.
 */
export const Route = createFileRoute('/_auth/add-cards')({
  component: AddCardsLayout,
});

function AddCardsLayout(): React.ReactElement {
  return <Outlet />;
}
