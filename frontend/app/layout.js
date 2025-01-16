
export const metadata = {
  title: "ping-pong",
  description: "Generated by : (abberkac)",
  
};
export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: 'no'
}

export default function RootLayout({children}) {
  return (
    <html lang="en">
      <body className={`bg-[#222831]`}>
          {children}
      </body>
    </html>
  );
}