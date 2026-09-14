'use client';

// Route page for the pricing builder.
// Place this file at:  app/(public)/pricing/page.tsx
// It renders inside your public layout, so the navbar + language switcher work.
// Adjust the import path if PricingBuilder.tsx isn't one folder up.
import PricingBuilder from './PricingBuilder';



export default function PricingPage() {
    return <PricingBuilder />;
}