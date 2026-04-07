import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-extrabold text-white">Page Not Found</h1>
      <p className="mt-2 max-w-md text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex gap-4">
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
        <Link to="/explore">
          <Button variant="outline">Explore Clubs</Button>
        </Link>
      </div>
    </div>
  );
}
