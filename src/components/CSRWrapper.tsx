"use client";

import React, { Suspense } from "react";

interface CSRWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Client-Side Rendering Wrapper with Suspense
 * 
 * Use this wrapper for pages that use client-side hooks like useSearchParams()
 * to avoid hydration errors and provide proper loading states.
 * 
 * @example
 * ```tsx
 * import CSRWrapper from "@/components/CSRWrapper";
 * 
 * export default function Page() {
 *   return (
 *     <CSRWrapper>
 *       <YourClientComponent />
 *     </CSRWrapper>
 *   );
 * }
 * ```
 */
export default function CSRWrapper({ 
  children, 
  fallback = <div className="flex items-center justify-center min-h-screen">Chargement…</div> 
}: CSRWrapperProps) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
