"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Trash2, Download } from "lucide-react"

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteAccountModal({ isOpen, onClose, onConfirm }: DeleteAccountModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <DialogTitle>Delete Your Account?</DialogTitle>
          </div>
          <DialogDescription>Are you sure you want to delete your Honua account?</DialogDescription>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">This action will permanently remove:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Your profile and all personal information</li>
              <li>All your posts, comments, and interactions</li>
              <li>Your profile and impact data</li>
              <li>Your followers and following connections</li>
              <li>All saved bookmarks and preferences</li>
            </ul>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                ⚠️ This action cannot be undone. Your data will be permanently lost.
              </p>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="w-full sm:w-auto">
            <Trash2 className="w-4 h-4 mr-2" />
            Yes, Delete My Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  confirmText: string
  onConfirmTextChange: (text: string) => void
  onConfirm: () => void
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  confirmText,
  onConfirmTextChange,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const requiredText = "Delete My Account"
  const isConfirmTextValid = confirmText === requiredText

  const handleConfirm = async () => {
    if (!isConfirmTextValid) return

    setIsDeleting(true)
    try {
      await onConfirm()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <DialogTitle>Final Confirmation</DialogTitle>
          </div>
          <DialogDescription>To confirm account deletion, please type the following text exactly:</DialogDescription>
          <div className="space-y-4 pt-2">
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
              <code className="text-sm font-mono">{requiredText}</code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-text">Confirmation Text</Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => onConfirmTextChange(e.target.value)}
                placeholder="Type the confirmation text..."
                className={`${confirmText && !isConfirmTextValid ? "border-red-500 focus:border-red-500" : ""}`}
              />
              {confirmText && !isConfirmTextValid && (
                <p className="text-sm text-red-500">Text doesn't match. Please type exactly: "{requiredText}"</p>
              )}
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="flex items-start space-x-2">
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Data Export Included</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    You'll receive an email with your data export before deletion is completed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmTextValid || isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeleting ? (
              "Deleting Account..."
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
