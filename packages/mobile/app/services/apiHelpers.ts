// /Users/goldp1/Polka/packages/mobile/app/services/apiHelpers.ts

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const handleApiResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    let message = data.detail || `HTTP error! status: ${response.status}`;
    
    // Handle FastAPI validation errors (422) - detail is an array of error objects
    if (response.status === 422 && Array.isArray(data.detail)) {
      const errorMessages = data.detail.map((err: any) => {
        const field = err.loc?.join('.') || 'field';
        return `${field}: ${err.msg || err.message || String(err)}`;
      });
      message = errorMessages.join('\n');
    } else if (typeof message === 'object') {
      // If detail is an object, try to extract a message
      message = JSON.stringify(message);
    }
    
    throw new ApiError(String(message), response.status);
  }

  return data;
};
