import { toastManager } from './toast';

export const useToast = () => {
    return {
        toast: (props: { title?: string; description?: string; variant?: 'default' | 'destructive' }) => {
            // Map variant to type if needed
            const type = props.variant === 'destructive' ? 'error' : 'info';
            toastManager.add({
                title: props.title,
                description: props.description,
                type
            });
        }
    };
};
