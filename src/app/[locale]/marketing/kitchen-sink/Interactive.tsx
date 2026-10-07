"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MenuItem, Modal, Popover } from "@/components/ui/Overlays";
import { useToast } from "@/components/ui/Toast";

export function OverlayDemos() {
  const t = useTranslations("kitchen");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const toast = useToast();

  return (
    <div className="flex flex-wrap items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("openModal")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("modalTitle")}
        closeLabel={tc("close")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button icon="publish" onClick={() => setOpen(false)}>
              {t("publish")}
            </Button>
          </>
        }
      >
        {t("modalText")}
      </Modal>

      <Popover
        trigger={({ open: isOpen, toggle, id }) => (
          <Button variant="outline" aria-expanded={isOpen} aria-controls={id} onClick={toggle}>
            {t("openMenu")}
          </Button>
        )}
      >
        <MenuItem>
          <Icon name="add" size={18} />
          {t("menuDuplicate")}
        </MenuItem>
        <MenuItem>
          <Icon name="preview" size={18} />
          {t("menuPreview")}
        </MenuItem>
        <MenuItem>
          <Icon name="delete" size={18} />
          {t("menuDelete")}
        </MenuItem>
      </Popover>

      <Button variant="outline" onClick={() => toast(t("toastText"), "link")}>
        {t("showToast")}
      </Button>
    </div>
  );
}
