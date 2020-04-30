import React, { useState, useEffect } from "react";
import { graphql } from "graphql";
import Navbar from "./Navbar.js";
import MetricSelector from "./MetricSelector.js";
import Graph from "./Graph.js";
import { ThemeProvider } from "@material-ui/core/styles";
import { Box, Container, Grid, Divider } from "@material-ui/core";
import { schema } from "./Mock.js";
import "./App.css";
import {
  pipe,
  length,
  curry,
  find,
  mapAccum,
  filter,
  flatten,
  equals,
  union,
  prop,
  isNil,
  keys,
  map,
  mean,
  path,
  reduce
} from "ramda";

import ApolloClient from 'apollo-client';

import { InMemoryCache } from 'apollo-cache-inmemory';

import { HttpLink } from 'apollo-link-http';

import { ApolloProvider } from '@apollo/react-hooks';

import { useQuery } from '@apollo/react-hooks';


import theme from "./theme.js";


const createApolloClient = (authToken) => {

  return new ApolloClient({

    link: new HttpLink({

      uri: 'http://128.232.124.187:8080/v1/graphql',

      headers: {

        Authorization: `Bearer ${authToken}`

      }

    }),

    cache: new InMemoryCache(),

  });

};


const query= /* GraphQL */ `
  query {
        benchmarkRuns {
            name
              time
              ops_per_sec
            }
    }
  }
`;

function benchmarkToChart(results) {
  const len = length(results);

  const [_, result] = mapAccum(
    (index, { hash, stats }) => {
      let shortHash = hash.substring(0, 8);

      let time = find(({ name }) => equals(name, "time"), stats);
      let opsPerSec = find(({ name }) => equals(name, "ops_per_sec"), stats);

      return [
        index + 1,
        {
          name: shortHash,
          relCommit: index - len + 1,
          time: time.mean,
          timeLimit: [
          ],
          opsPerSec: opsPerSec.mean,
          opsPerSecLimit: [
          ]
        }
      ];
    },
    0,
    results
  );

  console.log(result);
  return result;
}

const mapNil = curry((f, xs) => {
  if (isNil(xs)) return xs;
  return map(f, xs);
});

const GetBenchmarkDataQuery = () => {
  const {_, _, data} = useQuery(query);
  return data.benchmarkRuns;
}

function App() {
  const [data, setData] = useState({ data: { repositories: [] } });

  const client = createApolloClient(idToken);

  useEffect(() => {
    async function fetchData() {
      const result = await graphql(schema, query);

      setData(result.data);
    }
    fetchData();
  }, []);

  const repo = path(["repositories", 0], data);
  const title = path(["name"], repo);

  // Get the list of all benchmarks

  const commits = prop("commits", repo);
  const benchmarkNames = commits
    ? reduce(
      union,
      [],
      mapNil(
        pipe(
          prop("benchmarkRuns"),
          map(prop("data")),
          map(map(prop("name"))),
          reduce(union, [])
        ),
        commits
      )
    )
    : commits;

  var benches = [];

  if (!isNil(benchmarkNames)) {
    benches = map(name => {
      const results = commits.map(commit => {
        const all = commit.benchmarkRuns.map(({ data }) => data);

        const bar = { hash: commit.hash, stats: last };


        return data.benchmarkRuns;
      })[0];

      const chart = benchmarkToChart(results);

      return { name: name, chart: chart };
    }, benchmarkNames);
  }

  return (
    <div className="App">
      <ThemeProvider theme={theme}>
        <Navbar title={title} />
        <Container maxWidth="1700px">
          <Box p={2}>
            <Container>
              <MetricSelector metrics={["a", "b"]} />
            </Container>
          </Box>
          <Divider variant="middle" />
          <Box mt={2}>
            <Grid container spacing={2}>
              {benches.map(bench => (
                <Grid item xs>
                  <Graph bench={bench} />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </ThemeProvider>
    </div>
  );
}

export default App;
