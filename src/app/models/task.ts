export interface TaskComment {
    _id?: string;
    userId?: string;
    content: string;
    createdAt?: string;
}

export interface Task {
    _id: string;
    title: string;
    description: string;
    status?: string;
    columnId?: string | { _id: string };
    priority?: string | null;            
    dueDate?: string | null;           
    isCompleted?: boolean;
    comments?: TaskComment[];
}


