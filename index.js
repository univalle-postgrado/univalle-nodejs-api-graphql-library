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
    NONE
    FICTION
    MYSTERY
    FANTASY
    ROMANCE
  }

  type Author {
    name: String!
    nationality: String
  }

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    id: String!
    title: String!
    description: String
    isbn: String
    publisher: String!
    gender: Gender!
    publishYear: Int
    author: Author!
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    getBooksCount: Int!
    getAllBooks: [Book]
    getBook(id: String): Book
    getAllBooksByAuthor(authorName: String): [Book]

    getAllBooksFromRestApi: [Book]
  }

  type Mutation {
    addBook (
      title: String!
      description: String
      isbn: String
      publisher: String!
      gender: Gender!
      publishYear: Int
      authorName: String!
      authorNationality: String
    ): Book
    updateBook (
      id: String!
      title: String
      description: String
      isbn: String
      publisher: String
      gender: Gender
      publishYear: Int
      authorName: String
      authorNationality: String
    ): Book
    deleteBook (id: String!): Book

    addBookInRestApi (
      title: String!
      description: String
      isbn: String
      publisher: String!
      gender: Gender!
      publishYear: Int
      authorName: String!
      authorNationality: String
    ): Book

    updateBookInRestApi (
      id: String!
      title: String
      description: String
      isbn: String
      publisher: String
      gender: Gender
      publishYear: Int
      authorName: String
      authorNationality: String
    ): Book

    deleteBookInRestApi (id: String!): Book
  }

`;

const books = [
  {
    id: 'd26fd654-f4d4-4b98-91e5-6d8c9569aed6',
    title: 'The Awakening',
    description: 'The Awakening es una novela de la escritora estadounidense Kate Chopin.',
    publisher: 'W W Norton & Co Inc',
    gender: 'NONE',
    publishYear: 1899,
    authorName: 'Kate Chopin'
  },
  {
    id: '35b19ead-3aa9-415e-a46d-6621e1604119',
    title: 'City of Glass',
    description: 'Ciudad de cristal es el tercer libro de la saga Cazadores de Sombras, escrita por Cassandra Clare. Fue publicada originalmente en Estados Unidos.',
    isbn: '978-0140097313',
    publisher: 'Simon & Schuster',
    gender: 'FANTASY',
    publishYear: 2009,
    authorName: 'Paul Auster',
    authorNationality: 'Estadounidense'
  },
];

// Resolvers define how to fetch the types defined in your schema.
// This resolver retrieves books from the "books" array above.
const resolvers = {
  Book: {
    author: (root) => {
      return {
        name: root.authorName,
        nationality: root.authorNationality
      }
    }
  },

  Query: {
    getBooksCount: () => books.length,
    getAllBooks: () => books,
    getBook: (root, args) => {
      const {id} = args;
      return books.find(book => book.id === id);
    },
    getAllBooksByAuthor: (root, {authorName}) => books.filter(book => book.authorName === authorName),

    getAllBooksFromRestApi: async (root, args) => {
      const { data: booksFromRestApi } = await axios.get(process.env.API_URL + '/books');
      return booksFromRestApi;
    }
  },

  Mutation: {
    addBook: (root, args) => {
      if (books.find(b => b.title === args.title)) {
        throw new GraphQLError('Title must be unique', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      }
      
      const newBook = {...args, id: uuid()};
      books.push(newBook);
      return newBook;
    },
    updateBook: (root, args) => {
      const updatedBookIndex = books.findIndex(book => book.id === args.id);

      if (updatedBookIndex === -1) return null;

      const book = books[updatedBookIndex];
      const updatedBook = {...book,
        title: args.title ? args.title : book.title,
        description: args.description ? args.description : book.description,
        isbn: args.isbn ? args.isbn : book.isbn,
        publisher: args.publisher ? args.publisher : book.publisher,
        gender: args.gender ? args.gender : book.gender,
        publishYear: args.publishYear ? args.publishYear : book.publishYear,
        authorName: args.authorName ? args.authorName : book.authorName,
        authorNationality: args.authorNationality ? args.authorNationality : book.authorNationality
      };
      books[updatedBookIndex] = updatedBook;
      return updatedBook;
    },
    deleteBook: (root, {id}) => {
      const deletedBookIndex = books.findIndex(book => book.id === id);

      if (deletedBookIndex === -1) return null;

      const deletedBook = books.splice(deletedBookIndex, 1)[0];
      return deletedBook;
    },

    addBookInRestApi: async (root, args) => {
      const responseExistsBook = await axios.get(process.env.API_URL + '/books?title=' + args.title);
      console.log(responseExistsBook.data);
      if (responseExistsBook.data.length > 0) {
        throw new GraphQLError('Title must be unique', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      }

      const newBook = {...args};
      const response = await axios.post(process.env.API_URL + '/books', newBook);
      return response.data;
    },

    updateBookInRestApi: async (root, args) => {
      const responseExistsBook = await axios.get(process.env.API_URL + '/books/' + args.id)
        .catch(function (error) {
          return null;
        });

      // @TODO 
      if (responseExistsBook.status === 404) return null;

      const book = responseExistsBook.data;
      const updatedBook = {...book,
        title: args.title ? args.title : book.title,
        description: args.description ? args.description : book.description,
        isbn: args.isbn ? args.isbn : book.isbn,
        publisher: args.publisher ? args.publisher : book.publisher,
        gender: args.gender ? args.gender : book.gender,
        publishYear: args.publishYear ? args.publishYear : book.publishYear,
        authorName: args.authorName ? args.authorName : book.authorName,
        authorNationality: args.authorNationality ? args.authorNationality : book.authorNationality
      };

      const response = await axios.put(process.env.API_URL + '/books/' + book.id, updatedBook);
      return response.data;
    },
    deleteBookInRestApi: async (root, {id}) => {
      // const responseExistsBook = await axios.get(process.env.API_URL + '/books/' + args.id)
      //   .catch(function (error) {
      //     return null;
      //   });

      // if (deletedBookIndex === -1) return null;

      // const deletedBook = books.splice(deletedBookIndex, 1)[0];
      // return deletedBook;

      const response = await axios.delete(process.env.API_URL + '/books/' + id);
      return response.data;
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