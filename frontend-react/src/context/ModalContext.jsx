import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import Modal from "../components/common/Modal";

const ModalContext = createContext();

export function ModalProvider({ children }) {
    const [modal, setModal] = useState({
        show: false,
        title: "",
        message: "",
        type: "info",
        onClose: null,
        children: null
    });
    
    const showModal = useCallback(({ title, message, type = "info", onClose, children }) => {
        setModal({
            show: true,
            title,
            message,
            type,
            onClose: () => {
                if (onClose) onClose();
                setModal(prev => ({ ...prev, show: false }));
            },
            children
        });
    }, []);

    const hideModal = useCallback(() => {
        setModal(prev => ({ ...prev, show: false }));
    }, []);

    const contextValue = useMemo(() => ({ showModal, hideModal }), [showModal, hideModal]);

    return (
        <ModalContext.Provider value={contextValue}>
            {children}
            <Modal
                show={modal.show}
                onClose={modal.onClose || hideModal}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            >
                {modal.children}
            </Modal>
        </ModalContext.Provider>
    );
}

export const useModal = () => useContext(ModalContext);
