import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="That page does not exist"
      body="The link may be old. Everything you need is in the menu on the left."
      action={
        <Button asChild>
          <Link to="/app">Back to Today</Link>
        </Button>
      }
    />
  );
}
