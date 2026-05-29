import "./globals.css";

export const metadata = {
  title: "Ecomfy Mini Lead Routing Engine",
  description: "Lead routing, ping tree, ledger and operational reporting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
