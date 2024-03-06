import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import axios from 'axios';
import { GraphQLError } from 'graphql';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = `#graphql
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.

  enum Gender {
    DYSTOPIAN
    FICTION
    ROMANCE
    HORROR
    FANTASY
    MYSTERY
    ADVENTURE
    SATIRE
    WAR
    TRAGEDY
  }

  type Author {
    id: ID!,
    name: String!
    nationality: String
    books: [Book]
  }

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    id: ID!
    title: String!
    description: String
    isbn: String
    publisher: String!
    gender: Gender!
    year: Int
    author: Author!
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    getAllAuthors: [Author]
    getAuthor(id: String!): Author

    getAllBooks: [Book]
    getBook(id: String!): Book
    getAllBooksByAuthorName(authorName: String!): [Book]
  }

  type Mutation {
    addAuthor (
      name: String!
      nationality: String
    ): Author
    updateAuthor(
      id: ID!
      name: String!
      nationality: String
    ): Author
    deleteAuthor (id: ID!): Author

    addBook (
      title: String!
      description: String
      isbn: String
      publisher: String!
      gender: Gender!
      year: Int
      authorId: ID!
    ): Book
    updateBook (
      id: ID!
      title: String
      description: String
      isbn: String
      publisher: String
      gender: Gender
      year: Int
      authorId: ID
    ): Book
    deleteBook (id: ID!): Book
  }
`;

// Resolvers define how to fetch the types defined in your schema.
// This resolver retrieves books from the "books" array above.
const resolvers = {
  Book: {
    author: async (root) => {
      try {
        const { data: author } = await axios.get(process.env.API_URL + '/authors/' + root.author_id);
        return {
          name: author.name,
          nationality: author.nationality
        };
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        return null;
      }
    }
  },
  Author: {
    books: async (root) => {
      try {
        const { data: books } = await axios.get(process.env.API_URL + '/books?author_id=' + root.id);
        return books;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        return null;
      }
    }
  },

  Query: {
    getAllBooks: async (root, args) => {
      try {
        const { data: books } = await axios.get(process.env.API_URL + '/books');
        return books;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        return null;
      }
    },
    getBook: async (root, {id}) => {
      try {
        const { data: book } = await axios.get(process.env.API_URL + '/books/' + id);
        return book;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        return null;
      }
    },
    getAllBooksByAuthorName: async (root, {authorName}) => {
      try {
        const { data: author } = await axios.get(process.env.API_URL + '/authors?name=' + authorName);
        const { data: books } = await axios.get(process.env.API_URL + '/books?author_id=' + author[0].id);
        return books;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        return [];
      }
    },

    getAllAuthors: async (root, args) => {
      try {
        const { data: authors } = await axios.get(process.env.API_URL + '/authors');
        return authors;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        return null;
      }
    },
    getAuthor: async (root, {id}) => {
      try {
        const { data: author } = await axios.get(process.env.API_URL + '/authors/' + id);
        return author;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        return null;
      }
    },
  },

  Mutation: {
    addAuthor: async (root, args) => {
      let existsAuthor = false;
      try {
        // Verificamos si existe un libro con el mismo título
        const { data: authors } = await axios.get(process.env.API_URL + '/authors?name=' + args.name);
        if (authors.length > 0) {
          existsAuthor = true;
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') { 
          throw new Error('Error al conectar con el API');
        }
        throw new Error(error.message);
      }

      if (existsAuthor) {
        throw new GraphQLError('El nombre del autor ya existe', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      }

      const newAuthor = {
        name: args.name,
        nationality: args.nationality
      };
      try {
        // Creamos el recurso en el API RESTful
        const { data: author }  = await axios.post(process.env.API_URL + '/authors', newAuthor);
        return author;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        throw new Error(error.message);
      }
    },

    updateAuthor: async (root, args) => {
      // Obtenemos el autor con el ID
      const { data: author } = await axios.get(process.env.API_URL + '/authors/' + args.id).catch(function (error) {
        if (error.code === 'ECONNREFUSED') { 
          throw new Error('Error al conectar con el API');
        }
        throw new GraphQLError('No existe el author con el ID: ' + args.id, {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      });

      if (args.name) {
        let existsAuthorName = false;
        try {
          // Verificamos si existe un autor con el mismo nombre y que tenga diferente ID del que se está editando
          const { data: authors } = await axios.get(process.env.API_URL + '/authors?name=' + args.name + '&id_ne=' + args.id);
          if (authors.length > 0) {
            existsAuthorName = true;
          }
        } catch (error) {
          if (error.code === 'ECONNREFUSED') { 
            throw new Error('Error al conectar con el API');
          }
          throw new Error(error.message);
        }

        if (existsAuthorName) {
          throw new GraphQLError('El nombre del libro ya existe', {
            extensions: {
              code: 'BAD_USER_INPUT'
            }
          });
        }
      }

      const updatedAuthorData = {
        name: args.name ? args.name : author.name,
        nationality: args.nationality ? args.nationality : author.nationality
      };

      try {
        const { data: updatedAuthor } = await axios.put(process.env.API_URL + '/authors/' + author.id, updatedAuthorData);
        return updatedAuthor;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        throw new Error(error.message);
      }
    },
    deleteAuthor: async (root, {id}) => {
      // Obtenemos el autor con el ID
      await axios.get(process.env.API_URL + '/authors/' + id).catch(function (error) {
        if (error.code === 'ECONNREFUSED') { 
          throw new Error('Error al conectar con el API');
        }
        throw new GraphQLError('No existe el autor con el ID: ' + id, {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      });

      try {
        const { data: deletedAuthor } = await axios.delete(process.env.API_URL + '/authors/' + id);
        return deletedAuthor;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        throw new Error(error.message);
      }
    },

    addBook: async (root, args) => {
      let existsBook = false;
      try {
        // Verificamos si existe un libro con el mismo título
        const { data: books } = await axios.get(process.env.API_URL + '/books?title=' + args.title);
        if (books.length > 0) {
          existsBook = true;
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') { 
          throw new Error('Error al conectar con el API');
        }
        throw new Error(error.message);
      }

      if (existsBook) {
        throw new GraphQLError('El título del libro ya existe', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      }

      try {
        // Verificamos si el Autor existe
        await axios.get(process.env.API_URL + '/authors/' + args.authorId);
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Error al conectar con el API');
        }
        throw new GraphQLError('No existe el autor con el ID: ' + args.authorId, {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      }

      const newBook = {
        title: args.title,
        description: args.description,
        isbn: args.isbn,
        publisher: args.publisher,
        gender: args.gender,
        year: args.year,
        author_id: args.authorId
      };
      try {
        // Creamos el recurso en el API RESTful
        const { data: book }  = await axios.post(process.env.API_URL + '/books', newBook);
        return book;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        throw new Error(error.message);
      }
    },

    updateBook: async (root, args) => {
      // Obtenemos el libro con el ID
      const { data: book } = await axios.get(process.env.API_URL + '/books/' + args.id).catch(function (error) {
        if (error.code === 'ECONNREFUSED') { 
          throw new Error('Error al conectar con el API');
        }
        throw new GraphQLError('No existe el libro con el ID: ' + args.id, {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      });

      if (args.title) {
        let existsBookTitle = false;
        try {
          // Verificamos si existe un libro con el mismo título y que tenga diferente ID del que se está editando
          const { data: books } = await axios.get(process.env.API_URL + '/books?title=' + args.title + '&id_ne=' + args.id);
          if (books.length > 0) {
            existsBookTitle = true;
          }
        } catch (error) {
          if (error.code === 'ECONNREFUSED') { 
            throw new Error('Error al conectar con el API');
          }
          throw new Error(error.message);
        }

        if (existsBookTitle) {
          throw new GraphQLError('El título del libro ya existe', {
            extensions: {
              code: 'BAD_USER_INPUT'
            }
          });
        }
      }

      if (args.authorId) {
        try {
          // Verificamos si el Autor existe
          await axios.get(process.env.API_URL + '/authors/' + args.authorId);
        } catch (error) {
          if (error.code === 'ECONNREFUSED') {
            throw new Error('Error al conectar con el API');
          }
          throw new GraphQLError('No existe el autor con el ID: ' + args.authorId, {
            extensions: {
              code: 'BAD_USER_INPUT'
            }
          });
        }
      }

      const updatedBookData = {
        title: args.title ? args.title : book.title,
        description: args.description ? args.description : book.description,
        isbn: args.isbn ? args.isbn : book.isbn,
        publisher: args.publisher ? args.publisher : book.publisher,
        gender: args.gender ? args.gender : book.gender,
        year: args.year ? args.year : book.year,
        author_id: args.authorId ? args.authorId : book.authorName
      };

      try {
        const { data: updatedBook } = await axios.put(process.env.API_URL + '/books/' + book.id, updatedBookData);
        return updatedBook;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        throw new Error(error.message);
      }
    },
    deleteBook: async (root, {id}) => {
      // Obtenemos el libro con el ID
      await axios.get(process.env.API_URL + '/books/' + id).catch(function (error) {
        if (error.code === 'ECONNREFUSED') { 
          throw new Error('Error al conectar con el API');
        }
        throw new GraphQLError('No existe el libro con el ID: ' + id, {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      });

      try {
        const { data: deletedBook } = await axios.delete(process.env.API_URL + '/books/' + id);
        return deletedBook;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') throw new Error('Error al conectar con el API');
        throw new Error(error.message);
      }
    },

  }
};

// The ApolloServer constructor requires two parameters: your schema
// definition and your set of resolvers.
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Passing an ApolloServer instance to the `startStandaloneServer` function:
//  1. creates an Express app
//  2. installs your ApolloServer instance as middleware
//  3. prepares your app to handle incoming requests
const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(`🚀  Server ready at: ${url}`);