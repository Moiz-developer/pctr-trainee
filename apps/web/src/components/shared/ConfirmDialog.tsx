import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

/**
 * SYSTEM_PLAN.md §34: "Destructive admin actions... always route through a
 * shared ConfirmDialog." Used for archiving a course, retiring a module/
 * lesson, and revoking course access.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  isPending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={destructive ? "destructive" : "primary"}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
